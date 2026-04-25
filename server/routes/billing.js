import { Router } from 'express';
import { eq, desc, inArray, and, sql, lt } from 'drizzle-orm';
import db from '../db-postgres.js';
import { billingAccounts, invoices, familyInvoices, payments, enrollments, students, programs, guardianStudents, users, paymentAllocations, enrollmentOverrides, journalEntries } from '../schema.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { logAudit } from '../services/audit.service.js';
import { createNotification } from '../services/notification.service.js';
import { broadcastEvent } from '../services/sse.service.js';
import { recordPaymentReceived, recordWaiver, allocatePayment } from '../services/accounting.service.js';
import { getStripe } from '../services/stripe.service.js';

const router = Router();

router.get('/accounts', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const accounts = await db.select({
      id: billingAccounts.id,
      parentUserId: billingAccounts.parentUserId,
      balance: billingAccounts.balance,
      status: billingAccounts.status,
      stripeCustomerId: billingAccounts.stripeCustomerId,
      createdAt: billingAccounts.createdAt,
    }).from(billingAccounts).orderBy(desc(billingAccounts.createdAt));
    res.json({ success: true, accounts });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/my-account', requireAuth, async (req, res) => {
  try {
    const [account] = await db.select().from(billingAccounts)
      .where(eq(billingAccounts.parentUserId, req.user.id));
    res.json({ success: true, account: account || null });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/invoices', requireAuth, async (req, res) => {
  try {
    if (req.user.role === 'admin') {
      const allInvoices = await db.select({
        id: invoices.id,
        billingAccountId: invoices.billingAccountId,
        enrollmentId: invoices.enrollmentId,
        description: invoices.description,
        amount: invoices.amount,
        status: invoices.status,
        dueDate: invoices.dueDate,
        paidDate: invoices.paidDate,
        stripePaymentId: invoices.stripePaymentId,
        createdAt: invoices.createdAt,
        programName: programs.name,
        studentFirstName: students.firstName,
        studentLastName: students.lastName,
      }).from(invoices)
        .leftJoin(enrollments, eq(invoices.enrollmentId, enrollments.id))
        .leftJoin(programs, eq(enrollments.programId, programs.id))
        .leftJoin(students, eq(enrollments.studentId, students.id))
        .orderBy(desc(invoices.createdAt));
      const today = new Date().toISOString().split('T')[0];
      return res.json({
        success: true,
        invoices: allInvoices.map(inv => ({
          ...inv,
          status: (inv.status === 'pending' && inv.dueDate && inv.dueDate < today) ? 'past_due' : inv.status,
        })),
      });
    }

    const [account] = await db.select().from(billingAccounts)
      .where(eq(billingAccounts.parentUserId, req.user.id));
    if (!account) return res.json({ success: true, invoices: [] });

    const myInvoices = await db.select({
      id: invoices.id,
      billingAccountId: invoices.billingAccountId,
      enrollmentId: invoices.enrollmentId,
      description: invoices.description,
      amount: invoices.amount,
      status: invoices.status,
      dueDate: invoices.dueDate,
      paidDate: invoices.paidDate,
      stripePaymentId: invoices.stripePaymentId,
      createdAt: invoices.createdAt,
      programName: programs.name,
      studentFirstName: students.firstName,
      studentLastName: students.lastName,
    }).from(invoices)
      .leftJoin(enrollments, eq(invoices.enrollmentId, enrollments.id))
      .leftJoin(programs, eq(enrollments.programId, programs.id))
      .leftJoin(students, eq(enrollments.studentId, students.id))
      .where(eq(invoices.billingAccountId, account.id))
      .orderBy(desc(invoices.createdAt));
    const today2 = new Date().toISOString().split('T')[0];
    res.json({
      success: true,
      invoices: myInvoices.map(inv => ({
        ...inv,
        status: (inv.status === 'pending' && inv.dueDate && inv.dueDate < today2) ? 'past_due' : inv.status,
      })),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/payments', requireAuth, async (req, res) => {
  try {
    if (req.user.role === 'admin') {
      const allPayments = await db.select({
        id: payments.id,
        billingAccountId: payments.billingAccountId,
        invoiceId: payments.invoiceId,
        amount: payments.amount,
        method: payments.method,
        status: payments.status,
        processedAt: payments.processedAt,
        stripePaymentIntentId: payments.stripePaymentIntentId,
        createdAt: payments.createdAt,
        parentFirstName: users.firstName,
        parentLastName: users.lastName,
        parentEmail: users.email,
      }).from(payments)
        .leftJoin(billingAccounts, eq(payments.billingAccountId, billingAccounts.id))
        .leftJoin(users, eq(billingAccounts.parentUserId, users.id))
        .orderBy(desc(payments.createdAt));
      return res.json({ success: true, payments: allPayments });
    }

    const [account] = await db.select().from(billingAccounts)
      .where(eq(billingAccounts.parentUserId, req.user.id));
    if (!account) return res.json({ success: true, payments: [] });

    const myPayments = await db.select().from(payments)
      .where(eq(payments.billingAccountId, account.id))
      .orderBy(desc(payments.createdAt));
    res.json({ success: true, payments: myPayments });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/pay', requireAuth, async (req, res) => {
  try {
    const { invoiceId } = req.body;
    if (!invoiceId) {
      return res.status(400).json({ success: false, error: 'Invoice ID is required' });
    }

    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, parseInt(invoiceId)));
    if (!invoice) return res.status(404).json({ success: false, error: 'Invoice not found' });
    if (invoice.status === 'paid') return res.status(400).json({ success: false, error: 'Invoice already paid' });

    const [account] = await db.select().from(billingAccounts)
      .where(eq(billingAccounts.parentUserId, req.user.id));
    if (!account || account.id !== invoice.billingAccountId) {
      return res.status(403).json({ success: false, error: 'Not authorized to pay this invoice' });
    }

    // Sequential inserts — neon-http driver does not support transactions
    const [payment] = await db.insert(payments).values({
      billingAccountId: account.id,
      invoiceId: invoice.id,
      amount: invoice.amount,
      method: 'manual',
      status: 'completed',
      processedAt: new Date(),
    }).returning();

    await db.update(invoices).set({
      status: 'paid',
      paidDate: new Date().toISOString().split('T')[0],
    }).where(eq(invoices.id, invoice.id));

    if (invoice.enrollmentId) {
      await db.update(enrollments).set({ status: 'active' })
        .where(eq(enrollments.id, invoice.enrollmentId));

      const [enrollment] = await db.select().from(enrollments).where(eq(enrollments.id, invoice.enrollmentId));
      if (enrollment) {
        await db.update(students).set({ status: 'active' })
          .where(eq(students.id, enrollment.studentId));
      }
    }

    // Non-blocking accounting
    recordPaymentReceived(payment).catch(err => console.error('[accounting] recordPaymentReceived error:', err.message));
    allocatePayment(payment.id).catch(err => console.error('[accounting] allocatePayment error:', err.message));

    await logAudit({
      userId: req.user.id,
      action: 'create',
      entityType: 'payment',
      entityId: payment.id,
      details: { invoiceId: invoice.id, amount: invoice.amount, method: 'manual', status: 'completed' },
      ipAddress: req.ip,
    });

    await logAudit({
      userId: req.user.id,
      action: 'update',
      entityType: 'invoice',
      entityId: invoice.id,
      details: { status: 'paid' },
      ipAddress: req.ip,
    });

    await createNotification({
      userId: req.user.id,
      type: 'payment_success',
      title: 'Payment successful',
      body: `Your payment of $${invoice.amount} has been processed.`,
      link: '/hub/parent',
    });

    res.json({ success: true, payment, message: 'Payment processed successfully' });
  } catch (err) {
    console.error('Payment error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/pay-fail', requireAuth, async (req, res) => {
  try {
    const { invoiceId, reason } = req.body;
    if (!invoiceId) {
      return res.status(400).json({ success: false, error: 'Invoice ID is required' });
    }

    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, parseInt(invoiceId)));
    if (!invoice) return res.status(404).json({ success: false, error: 'Invoice not found' });

    const [account] = await db.select().from(billingAccounts)
      .where(eq(billingAccounts.parentUserId, req.user.id));
    if (!account || account.id !== invoice.billingAccountId) {
      return res.status(403).json({ success: false, error: 'Not authorized for this invoice' });
    }

    const [payment] = await db.insert(payments).values({
      billingAccountId: account.id,
      invoiceId: invoice.id,
      amount: invoice.amount,
      method: 'manual',
      status: 'failed',
      processedAt: new Date(),
    }).returning();

    await logAudit({
      userId: req.user.id,
      action: 'create',
      entityType: 'payment',
      entityId: payment.id,
      details: { invoiceId: invoice.id, amount: invoice.amount, status: 'failed', reason },
      ipAddress: req.ip,
    });

    res.json({ success: true, payment, message: 'Payment failed' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.patch('/invoices/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { status, dueDate, amount } = req.body;
    const updateData = {};
    if (status !== undefined) updateData.status = status;
    if (dueDate !== undefined) updateData.dueDate = dueDate;
    if (amount !== undefined) updateData.amount = amount;

    const [updated] = await db.update(invoices).set(updateData).where(eq(invoices.id, id)).returning();
    if (!updated) return res.status(404).json({ success: false, error: 'Invoice not found' });

    await logAudit({
      userId: req.user.id,
      action: 'update',
      entityType: 'invoice',
      entityId: id,
      details: updateData,
      ipAddress: req.ip,
    });

    res.json({ success: true, invoice: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /billing/accounting — unified per-enrollment accounting view (admin only)
router.get('/accounting', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    // Query 1: enrollments + students + programs
    const enrollmentRows = await db.select({
      enrollmentId: enrollments.id,
      enrollmentStatus: enrollments.status,
      startDate: enrollments.startDate,
      billingCycleOverride: enrollments.billingCycleOverride,
      studentId: students.id,
      studentFirstName: students.firstName,
      studentLastName: students.lastName,
      programName: programs.name,
      programBillingCycle: programs.billingCycle,
    }).from(enrollments)
      .leftJoin(students, eq(enrollments.studentId, students.id))
      .leftJoin(programs, eq(enrollments.programId, programs.id))
      .orderBy(desc(enrollments.createdAt));

    if (!enrollmentRows.length) return res.json({ success: true, rows: [] });

    const studentIds = [...new Set(enrollmentRows.map(r => r.studentId).filter(Boolean))];
    const enrollmentIds = enrollmentRows.map(r => r.enrollmentId);

    // Query 2: parent info per student via guardianStudents
    const guardianRows = studentIds.length
      ? await db.select({
          studentId: guardianStudents.studentId,
          parentFirstName: users.firstName,
          parentLastName: users.lastName,
          parentEmail: users.email,
        }).from(guardianStudents)
          .leftJoin(users, eq(guardianStudents.guardianUserId, users.id))
          .where(inArray(guardianStudents.studentId, studentIds))
      : [];

    // Query 3: all invoices for these enrollments, latest per enrollment resolved in JS
    const invoiceRows = await db.select().from(invoices)
      .where(inArray(invoices.enrollmentId, enrollmentIds))
      .orderBy(desc(invoices.createdAt));

    // Query 4: all payments for those invoices
    const invoiceIds = [...new Set(invoiceRows.map(r => r.id))];
    const paymentRows = invoiceIds.length
      ? await db.select().from(payments)
          .where(inArray(payments.invoiceId, invoiceIds))
          .orderBy(desc(payments.processedAt))
      : [];

    // Build lookup maps
    const parentMap = {};
    for (const g of guardianRows) {
      if (!parentMap[g.studentId]) parentMap[g.studentId] = g;
    }

    const invoiceMap = {};
    for (const inv of invoiceRows) {
      if (!invoiceMap[inv.enrollmentId]) invoiceMap[inv.enrollmentId] = inv;
    }

    const paymentsByInvoice = {};
    for (const p of paymentRows) {
      if (!paymentsByInvoice[p.invoiceId]) paymentsByInvoice[p.invoiceId] = [];
      paymentsByInvoice[p.invoiceId].push(p);
    }

    const today = new Date().toISOString().split('T')[0];
    const result = enrollmentRows.map(row => {
      const parent = parentMap[row.studentId] || {};
      const invoice = invoiceMap[row.enrollmentId] || null;
      const pmts = invoice ? (paymentsByInvoice[invoice.id] || []) : [];
      const effectiveCycle = row.billingCycleOverride || row.programBillingCycle || 'one_time';

      // Compute effective invoice status: pending + overdue dueDate → past_due
      const effectiveInvoiceStatus = (invoice?.status === 'pending' && invoice?.dueDate && invoice.dueDate < today)
        ? 'past_due'
        : invoice?.status;

      const totalPaid = pmts
        .filter(p => p.status === 'paid' || p.status === 'completed')
        .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);

      const totalOwed = invoice && ['pending', 'past_due'].includes(effectiveInvoiceStatus)
        ? parseFloat(invoice.amount || 0)
        : 0;

      const lastPayment = pmts.find(p => p.status === 'paid' || p.status === 'completed');
      const lastPaymentDate = lastPayment?.processedAt || null;

      let nextDueDate = null;
      if (invoice?.status === 'paid' && lastPaymentDate) {
        const d = new Date(lastPaymentDate);
        if (effectiveCycle === 'monthly') {
          d.setMonth(d.getMonth() + 1);
          nextDueDate = d.toISOString().split('T')[0];
        } else if (effectiveCycle === 'annual') {
          d.setFullYear(d.getFullYear() + 1);
          nextDueDate = d.toISOString().split('T')[0];
        }
      } else if (invoice?.dueDate) {
        nextDueDate = invoice.dueDate;
      }

      return {
        enrollmentId: row.enrollmentId,
        enrollmentStatus: row.enrollmentStatus,
        startDate: row.startDate,
        studentName: [row.studentFirstName, row.studentLastName].filter(Boolean).join(' ') || '—',
        parentName: [parent.parentFirstName, parent.parentLastName].filter(Boolean).join(' ') || '—',
        parentEmail: parent.parentEmail || null,
        programName: row.programName || '—',
        billingCycle: effectiveCycle,
        invoiceId: invoice?.id ?? null,
        invoiceAmount: invoice?.amount ?? null,
        invoiceDiscountPercent: invoice?.discountPercent ?? null,
        invoiceStatus: effectiveInvoiceStatus ?? null,
        familyInvoiceId: invoice?.familyInvoiceId ?? null,
        familyInvoiceTotal: null,  // populated below
        dueDate: invoice?.dueDate ?? null,
        paidDate: invoice?.paidDate ?? null,
        totalPaid: totalPaid.toFixed(2),
        totalOwed: totalOwed.toFixed(2),
        lastPaymentDate,
        nextDueDate,
        payments: pmts,
      };
    });

    // Attach family invoice totals
    const fiIds = [...new Set(result.filter(r => r.familyInvoiceId).map(r => r.familyInvoiceId))];
    if (fiIds.length > 0) {
      const fiRows = await db.select({ id: familyInvoices.id, totalAmount: familyInvoices.totalAmount })
        .from(familyInvoices)
        .where(inArray(familyInvoices.id, fiIds));
      const fiMap = Object.fromEntries(fiRows.map(f => [f.id, f.totalAmount]));
      for (const r of result) {
        if (r.familyInvoiceId && fiMap[r.familyInvoiceId] != null) {
          r.familyInvoiceTotal = fiMap[r.familyInvoiceId];
        }
      }
    }

    // Attach active overrides for scholarship/waiver transparency
    if (enrollmentIds.length > 0) {
      const overrideRows = await db.select({
        enrollmentId: enrollmentOverrides.enrollmentId,
        overrideType: enrollmentOverrides.overrideType,
        reason: enrollmentOverrides.reason,
        amountWaivedCents: enrollmentOverrides.amountWaivedCents,
        amountDeferredCents: enrollmentOverrides.amountDeferredCents,
        amountDueNowCents: enrollmentOverrides.amountDueNowCents,
        approvedByName: enrollmentOverrides.approvedByName,
        notes: enrollmentOverrides.notes,
      }).from(enrollmentOverrides)
        .where(and(
          inArray(enrollmentOverrides.enrollmentId, enrollmentIds),
          eq(enrollmentOverrides.isActive, true)
        ));
      const overrideMap = Object.fromEntries(overrideRows.map(o => [o.enrollmentId, o]));
      for (const r of result) {
        r.activeOverride = overrideMap[r.enrollmentId] || null;
      }
    }

    res.json({ success: true, rows: result });
  } catch (err) {
    console.error('[billing/accounting] error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /billing/invoices/:invoiceId/admin-action
// Admin-only: manually pay, waive, or reopen a single invoice with full cascade.
router.post('/invoices/:invoiceId/admin-action', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const invoiceId = parseInt(req.params.invoiceId);
    const { action, reason } = req.body;

    if (!['manual_pay', 'waive', 'reopen'].includes(action)) {
      return res.status(400).json({ success: false, error: 'Invalid action. Use manual_pay, waive, or reopen.' });
    }

    const [inv] = await db.select().from(invoices).where(eq(invoices.id, invoiceId));
    if (!inv) return res.status(404).json({ success: false, error: 'Invoice not found' });

    const today = new Date().toISOString().split('T')[0];

    if (action === 'manual_pay') {
      if (['paid', 'waived'].includes(inv.status)) {
        return res.status(400).json({ success: false, error: 'Invoice is already closed' });
      }
      await db.update(invoices).set({ status: 'paid', paidDate: today }).where(eq(invoices.id, invoiceId));
      const [adminPayment] = await db.insert(payments).values({
        billingAccountId: inv.billingAccountId,
        invoiceId: inv.id,
        amount: String(inv.amount),
        method: 'manual',
        status: 'paid',
        processedAt: new Date(),
      }).returning();
      if (inv.enrollmentId) {
        const [enr] = await db.select().from(enrollments).where(eq(enrollments.id, inv.enrollmentId));
        if (enr) {
          await db.update(enrollments).set({ status: 'active' }).where(eq(enrollments.id, enr.id));
          if (enr.studentId) await db.update(students).set({ status: 'active' }).where(eq(students.id, enr.studentId));
        }
      }
      // Non-blocking accounting
      if (adminPayment) {
        recordPaymentReceived(adminPayment).catch(err => console.error('[accounting] recordPaymentReceived error:', err.message));
        allocatePayment(adminPayment.id).catch(err => console.error('[accounting] allocatePayment error:', err.message));
      }
    }

    if (action === 'waive') {
      if (['paid', 'waived'].includes(inv.status)) {
        return res.status(400).json({ success: false, error: 'Invoice is already closed' });
      }
      // Capture remaining AR balance before zeroing invoice (partial payment may have reduced it)
      const [allocRow] = await db.select({ total: sql`COALESCE(SUM(${paymentAllocations.amount}::numeric), 0)` })
        .from(paymentAllocations)
        .where(eq(paymentAllocations.invoiceId, invoiceId));
      const remainingAR = Math.max(0, parseFloat(inv.amount) - parseFloat(allocRow?.total || 0));

      await db.update(invoices).set({ status: 'waived', paidDate: today }).where(eq(invoices.id, invoiceId));
      if (inv.enrollmentId) {
        const [enr] = await db.select().from(enrollments).where(eq(enrollments.id, inv.enrollmentId));
        if (enr) {
          await db.update(enrollments).set({ status: 'active_override' }).where(eq(enrollments.id, enr.id));
          if (enr.studentId) await db.update(students).set({ status: 'active' }).where(eq(students.id, enr.studentId));
        }
      }
      // Non-blocking accounting — DR Scholarship Allowance / CR AR for remaining balance
      if (remainingAR > 0) {
        recordWaiver(inv, remainingAR).catch(err => console.error('[accounting] recordWaiver error:', err.message));
      }
    }

    if (action === 'reopen') {
      if (!['paid', 'waived'].includes(inv.status)) {
        return res.status(400).json({ success: false, error: 'Invoice is not closed' });
      }
      await db.update(invoices).set({ status: 'pending', paidDate: null }).where(eq(invoices.id, invoiceId));
      if (inv.enrollmentId) {
        await db.update(enrollments).set({ status: 'pending_payment' }).where(eq(enrollments.id, inv.enrollmentId));
      }
    }

    // Cascade to family invoice: recalculate total + sync status.
    // Resolve the target family invoice: prefer the linked one on the invoice; fall back
    // to any pending family invoice for this billing account so changes made before the
    // parent's first auto-consolidation are still reflected.
    let targetFiId = inv.familyInvoiceId;
    if (!targetFiId && inv.billingAccountId) {
      // Invoice not yet linked — find a pending family invoice for this billing account
      // so admin actions made before first parent consolidation still cascade correctly.
      const [fallbackFi] = await db.select({ id: familyInvoices.id })
        .from(familyInvoices)
        .where(and(
          eq(familyInvoices.billingAccountId, inv.billingAccountId),
          inArray(familyInvoices.status, ['pending', 'past_due'])
        ))
        .orderBy(desc(familyInvoices.id))
        .limit(1);
      if (fallbackFi) targetFiId = fallbackFi.id;
    }

    if (targetFiId) {
      const siblings = await db.select({ status: invoices.status, amount: invoices.amount })
        .from(invoices)
        .where(eq(invoices.familyInvoiceId, targetFiId));

      const allClosed = siblings.length > 0 &&
        siblings.every(s => ['paid', 'waived'].includes(s.status));
      const unpaidTotal = siblings
        .filter(s => ['pending', 'past_due'].includes(s.status))
        .reduce((sum, s) => sum + parseFloat(s.amount || 0), 0);

      if (allClosed) {
        await db.update(familyInvoices)
          .set({ status: 'paid', paidDate: today })
          .where(eq(familyInvoices.id, targetFiId));
      } else {
        const fiUpdate = { totalAmount: String(unpaidTotal) };
        if (action === 'reopen') {
          fiUpdate.status = 'pending';
          fiUpdate.paidDate = null;
        }
        await db.update(familyInvoices)
          .set(fiUpdate)
          .where(eq(familyInvoices.id, targetFiId));
      }
    }

    await logAudit({
      userId: req.user.id,
      action: 'admin_action',
      entityType: 'invoice',
      entityId: String(invoiceId),
      details: { action, reason: reason || null },
      ipAddress: req.ip,
    });

    broadcastEvent('billing.invoice.action', { invoiceId, action });
    res.json({ success: true });
  } catch (err) {
    console.error('[billing] admin-action error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /billing/audit — read-only billing consistency check (admin only)
router.get('/audit', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const issues = [];

    // 1. Paid invoice but enrollment is not active / active_override / cancelled
    const paidInvoiceCheck = await db.select({
      invoiceId: invoices.id,
      invoiceAmount: invoices.amount,
      enrollmentId: invoices.enrollmentId,
      enrollmentStatus: enrollments.status,
    }).from(invoices)
      .innerJoin(enrollments, eq(invoices.enrollmentId, enrollments.id))
      .where(and(
        eq(invoices.status, 'paid'),
        inArray(enrollments.status, ['pending_payment', 'pending', 'payment_failed'])
      ));

    for (const r of paidInvoiceCheck) {
      issues.push({
        type: 'paid_invoice_inactive_enrollment',
        severity: 'critical',
        message: `Invoice #${r.invoiceId} ($${r.invoiceAmount}) is paid but enrollment #${r.enrollmentId} has status "${r.enrollmentStatus}"`,
        ids: { invoiceId: r.invoiceId, enrollmentId: r.enrollmentId },
      });
    }

    // 2. Active enrollment whose latest invoice is still pending or past_due
    const activeEnrs = await db.select({ id: enrollments.id, status: enrollments.status })
      .from(enrollments)
      .where(inArray(enrollments.status, ['active', 'active_override']));

    if (activeEnrs.length > 0) {
      const activeIds = activeEnrs.map(e => e.id);
      const recentInvoices = await db.select()
        .from(invoices)
        .where(inArray(invoices.enrollmentId, activeIds))
        .orderBy(desc(invoices.createdAt));

      const latestByEnrollment = {};
      for (const inv of recentInvoices) {
        if (!latestByEnrollment[inv.enrollmentId]) latestByEnrollment[inv.enrollmentId] = inv;
      }
      for (const enr of activeEnrs) {
        const inv = latestByEnrollment[enr.id];
        if (inv && ['pending', 'past_due'].includes(inv.status)) {
          issues.push({
            type: 'active_enrollment_unpaid_invoice',
            severity: 'high',
            message: `Enrollment #${enr.id} is "${enr.status}" but its latest invoice #${inv.id} is "${inv.status}"`,
            ids: { enrollmentId: enr.id, invoiceId: inv.id },
          });
        }
      }
    }

    // 3. Paid family invoice with at least one unpaid child invoice
    const paidFamilies = await db.select({ id: familyInvoices.id })
      .from(familyInvoices)
      .where(eq(familyInvoices.status, 'paid'));

    if (paidFamilies.length > 0) {
      const paidFiIds = paidFamilies.map(f => f.id);
      const unpaidChildren = await db.select({
        invoiceId: invoices.id,
        familyInvoiceId: invoices.familyInvoiceId,
        status: invoices.status,
        enrollmentId: invoices.enrollmentId,
      }).from(invoices)
        .where(and(
          inArray(invoices.familyInvoiceId, paidFiIds),
          inArray(invoices.status, ['pending', 'past_due'])
        ));

      for (const child of unpaidChildren) {
        issues.push({
          type: 'paid_family_invoice_unpaid_child',
          severity: 'critical',
          message: `Family invoice #${child.familyInvoiceId} is paid but child invoice #${child.invoiceId} is "${child.status}"`,
          ids: { familyInvoiceId: child.familyInvoiceId, invoiceId: child.invoiceId, enrollmentId: child.enrollmentId },
        });
      }
    }

    // 4. Paid invoice with no payment allocation record
    const paidInvList = await db.select({ id: invoices.id })
      .from(invoices)
      .where(eq(invoices.status, 'paid'));

    if (paidInvList.length > 0) {
      const paidInvIds2 = paidInvList.map(i => i.id);
      const allocatedInvoiceIds = new Set(
        (await db.select({ invoiceId: paymentAllocations.invoiceId })
          .from(paymentAllocations)
          .where(inArray(paymentAllocations.invoiceId, paidInvIds2)))
          .map(r => r.invoiceId)
      );
      for (const { id } of paidInvList) {
        if (!allocatedInvoiceIds.has(id)) {
          issues.push({
            type: 'paid_invoice_no_allocation',
            severity: 'medium',
            message: `Paid invoice #${id} has no payment allocation record (GL ledger may be incomplete)`,
            ids: { invoiceId: id },
          });
        }
      }
    }

    // 5. Successful payment record with no allocation
    const successPayments = await db.select({ id: payments.id, invoiceId: payments.invoiceId, amount: payments.amount })
      .from(payments)
      .where(inArray(payments.status, ['paid', 'completed']));

    if (successPayments.length > 0) {
      const pmtIds = successPayments.map(p => p.id);
      const allocatedPaymentIds = new Set(
        (await db.select({ paymentId: paymentAllocations.paymentId })
          .from(paymentAllocations)
          .where(inArray(paymentAllocations.paymentId, pmtIds)))
          .map(r => r.paymentId)
      );
      for (const pmt of successPayments) {
        if (!allocatedPaymentIds.has(pmt.id)) {
          issues.push({
            type: 'payment_no_allocation',
            severity: 'medium',
            message: `Payment #${pmt.id} ($${pmt.amount}) has no allocation record`,
            ids: { paymentId: pmt.id, invoiceId: pmt.invoiceId },
          });
        }
      }
    }

    // 6. Billing accounts with an unspent credit balance
    const creditAccts = await db.select({
      id: billingAccounts.id,
      parentUserId: billingAccounts.parentUserId,
      balance: billingAccounts.balance,
    }).from(billingAccounts)
      .where(sql`${billingAccounts.balance}::numeric > 0`);

    for (const acct of creditAccts) {
      issues.push({
        type: 'unspent_credit_balance',
        severity: 'low',
        message: `Billing account #${acct.id} (parent #${acct.parentUserId}) has unused credit balance $${acct.balance} — not yet applied to any invoice`,
        ids: { billingAccountId: acct.id, parentUserId: acct.parentUserId },
      });
    }

    // 7. Enrollments stuck in payment_failed
    const failedEnrs = await db.select({ id: enrollments.id, studentId: enrollments.studentId })
      .from(enrollments)
      .where(eq(enrollments.status, 'payment_failed'));

    for (const enr of failedEnrs) {
      issues.push({
        type: 'payment_failed_enrollment',
        severity: 'high',
        message: `Enrollment #${enr.id} is in payment_failed status — parent must retry or update their billing method`,
        ids: { enrollmentId: enr.id, studentId: enr.studentId },
      });
    }

    // Check 8: Revenue recognition staleness (Vercel has no cron — admin must trigger manually)
    let lastRecognitionDate = null;
    try {
      const [lastEntry] = await db.select({ createdAt: journalEntries.createdAt })
        .from(journalEntries)
        .where(eq(journalEntries.referenceType, 'recognition'))
        .orderBy(desc(journalEntries.createdAt))
        .limit(1);
      if (lastEntry) {
        lastRecognitionDate = lastEntry.createdAt?.toISOString?.() ?? null;
        const daysSince = Math.floor((Date.now() - new Date(lastEntry.createdAt).getTime()) / 86400000);
        if (daysSince > 35) {
          issues.push({
            type: 'recognition_stale',
            severity: 'medium',
            message: `Revenue recognition last ran ${daysSince} days ago (${new Date(lastEntry.createdAt).toLocaleDateString()}). Run recognition for the current period.`,
            ids: { daysSince },
          });
        }
      } else {
        issues.push({
          type: 'recognition_never_run',
          severity: 'medium',
          message: 'Revenue recognition has never been run. Deferred revenue has not been recognized.',
          ids: {},
        });
      }
    } catch (recErr) {
      // journal_entries table may not exist yet on fresh deploy — non-fatal
      console.error('[billing/audit] recognition check error (non-fatal):', recErr.message);
    }

    const counts = {
      total: issues.length,
      critical: issues.filter(i => i.severity === 'critical').length,
      high:     issues.filter(i => i.severity === 'high').length,
      medium:   issues.filter(i => i.severity === 'medium').length,
      low:      issues.filter(i => i.severity === 'low').length,
    };

    res.json({ success: true, issues, counts, lastRecognitionDate });
  } catch (err) {
    console.error('[billing/audit] error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /billing/reconciliation — compare local records with Stripe (admin, read-only)
router.get('/reconciliation', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 100);

    // 1. Fetch recent family invoices (Stripe-involved payments)
    const recentFamilyInvoices = await db.select({
      id: familyInvoices.id,
      billingAccountId: familyInvoices.billingAccountId,
      totalAmount: familyInvoices.totalAmount,
      status: familyInvoices.status,
      stripeSessionId: familyInvoices.stripeSessionId,
      stripePaymentId: familyInvoices.stripePaymentId,
      createdAt: familyInvoices.createdAt,
      parentUserId: billingAccounts.parentUserId,
    }).from(familyInvoices)
      .leftJoin(billingAccounts, eq(billingAccounts.id, familyInvoices.billingAccountId))
      .orderBy(desc(familyInvoices.createdAt))
      .limit(limit);

    // 2. Fetch recent Stripe payments (exclude manual/credit — no Stripe to reconcile)
    const recentPayments = await db.select({
      id: payments.id,
      billingAccountId: payments.billingAccountId,
      invoiceId: payments.invoiceId,
      amount: payments.amount,
      method: payments.method,
      status: payments.status,
      stripePaymentIntentId: payments.stripePaymentIntentId,
      createdAt: payments.createdAt,
    }).from(payments)
      .where(eq(payments.method, 'stripe'))
      .orderBy(desc(payments.createdAt))
      .limit(limit);

    // 3. Fetch payment_allocations for the Stripe payments
    const paymentIds = recentPayments.map(p => p.id);
    const allocationsByPayment = {};
    if (paymentIds.length > 0) {
      const allocs = await db.select({
        paymentId: paymentAllocations.paymentId,
        invoiceId: paymentAllocations.invoiceId,
        amount: paymentAllocations.amount,
      }).from(paymentAllocations).where(inArray(paymentAllocations.paymentId, paymentIds));
      for (const a of allocs) {
        if (!allocationsByPayment[a.paymentId]) allocationsByPayment[a.paymentId] = [];
        allocationsByPayment[a.paymentId].push(a);
      }
    }

    // 4. Fetch child invoice statuses for family invoices
    const fiIds = recentFamilyInvoices.map(fi => fi.id);
    const childInvoicesByFI = {};
    if (fiIds.length > 0) {
      const children = await db.select({
        familyInvoiceId: invoices.familyInvoiceId,
        id: invoices.id,
        status: invoices.status,
        amount: invoices.amount,
      }).from(invoices).where(inArray(invoices.familyInvoiceId, fiIds));
      for (const c of children) {
        if (!childInvoicesByFI[c.familyInvoiceId]) childInvoicesByFI[c.familyInvoiceId] = [];
        childInvoicesByFI[c.familyInvoiceId].push(c);
      }
    }

    // 5. Stripe lookups — run in parallel, cap total to limit
    let stripeAvailable = true;
    const stripeSessionCache = {};
    const stripeIntentCache = {};

    try {
      const stripe = getStripe();
      await Promise.all([
        ...recentFamilyInvoices
          .filter(fi => fi.stripeSessionId)
          .map(async fi => {
            try {
              stripeSessionCache[fi.stripeSessionId] = await stripe.checkout.sessions.retrieve(fi.stripeSessionId);
            } catch (e) {
              stripeSessionCache[fi.stripeSessionId] = { _error: e.message };
            }
          }),
        ...recentPayments
          .filter(p => p.stripePaymentIntentId)
          .map(async p => {
            try {
              stripeIntentCache[p.stripePaymentIntentId] = await stripe.paymentIntents.retrieve(p.stripePaymentIntentId);
            } catch (e) {
              stripeIntentCache[p.stripePaymentIntentId] = { _error: e.message };
            }
          }),
      ]);
    } catch (_initErr) {
      // STRIPE_SECRET_KEY not set or Stripe unavailable — still return local data
      stripeAvailable = false;
    }

    // 6. Build rows with issue detection
    const SEV_ORDER = { critical: 0, high: 1, medium: 2, low: 3, none: 4 };
    const rows = [];

    // ── Family invoice rows ──────────────────────────────────────────────────
    for (const fi of recentFamilyInvoices) {
      const localAmount = parseFloat(fi.totalAmount || 0);
      let stripeStatus = null;
      let stripeAmount = null;
      let stripePaid = null;
      let issue = null;
      let severity = 'none';

      if (!stripeAvailable) {
        stripeStatus = 'stripe_unavailable';
      } else if (fi.stripeSessionId) {
        const session = stripeSessionCache[fi.stripeSessionId];
        if (session?._error) {
          stripeStatus = 'lookup_failed';
          issue = `Stripe lookup failed: ${session._error}`;
          severity = 'medium';
        } else if (session) {
          stripeStatus = session.payment_status; // 'paid' | 'unpaid' | 'no_payment_required'
          stripeAmount = session.amount_total != null ? session.amount_total / 100 : null;
          stripePaid = session.payment_status === 'paid';

          if (fi.status === 'paid' && !stripePaid) {
            issue = 'Local marked paid but Stripe session is not paid';
            severity = 'critical';
          } else if (stripePaid && fi.status !== 'paid') {
            issue = 'Stripe session is paid but local family invoice is not marked paid';
            severity = 'critical';
          } else if (stripePaid && stripeAmount != null && Math.abs(stripeAmount - localAmount) > 0.01) {
            issue = `Amount mismatch: local $${localAmount.toFixed(2)} vs Stripe $${stripeAmount.toFixed(2)}`;
            severity = 'high';
          }
        }
      } else if (fi.status === 'paid' && !fi.stripePaymentId) {
        // Paid without any Stripe involvement (manual/credit) — mark as not applicable
        stripeStatus = 'not_applicable';
      } else if (fi.status !== 'paid') {
        stripeStatus = 'no_session';
      }

      // Child invoice consistency check
      const children = childInvoicesByFI[fi.id] || [];
      const allocationStatus = children.length === 0 ? 'none'
        : children.every(c => ['paid', 'waived'].includes(c.status)) ? 'allocated'
        : fi.status === 'paid' ? 'partial_allocation' : 'allocated';

      if (fi.status === 'paid' && allocationStatus === 'partial_allocation') {
        if (!issue) { issue = 'Family invoice paid but some child invoices are still unpaid'; severity = 'high'; }
      }

      rows.push({
        type: 'family_invoice',
        localId: fi.id,
        billingAccountId: fi.billingAccountId,
        parentUserId: fi.parentUserId,
        localStatus: fi.status,
        localAmount,
        stripeSessionId: fi.stripeSessionId || null,
        stripeStatus,
        stripeAmount,
        stripePaid,
        allocationStatus,
        issue,
        severity,
        createdAt: fi.createdAt?.toISOString?.() ?? null,
      });
    }

    // ── Payment rows ─────────────────────────────────────────────────────────
    for (const p of recentPayments) {
      const localAmount = parseFloat(p.amount || 0);
      let stripeStatus = null;
      let stripeAmount = null;
      let stripePaid = null;
      let issue = null;
      let severity = 'none';

      if (!stripeAvailable) {
        stripeStatus = 'stripe_unavailable';
      } else if (p.stripePaymentIntentId) {
        const intent = stripeIntentCache[p.stripePaymentIntentId];
        if (intent?._error) {
          stripeStatus = 'lookup_failed';
          issue = `Stripe lookup failed: ${intent._error}`;
          severity = 'medium';
        } else if (intent) {
          stripeStatus = intent.status; // 'succeeded' | 'processing' | 'requires_payment_method' | etc.
          stripeAmount = intent.amount != null ? intent.amount / 100 : null;
          stripePaid = intent.status === 'succeeded';

          if (p.status === 'paid' && !stripePaid) {
            issue = 'Local payment is paid but Stripe payment intent has not succeeded';
            severity = 'critical';
          } else if (stripePaid && p.status !== 'paid') {
            issue = 'Stripe payment intent succeeded but local payment is not marked paid';
            severity = 'critical';
          } else if (stripePaid && stripeAmount != null && Math.abs(stripeAmount - localAmount) > 0.01) {
            issue = `Amount mismatch: local $${localAmount.toFixed(2)} vs Stripe $${stripeAmount.toFixed(2)}`;
            severity = 'high';
          }
        }
      } else {
        // Stripe payment without a payment intent ID
        issue = 'Stripe payment is missing payment intent ID';
        severity = 'medium';
        stripeStatus = 'no_intent_id';
      }

      // Allocation check
      const allocs = allocationsByPayment[p.id] || [];
      let allocationStatus;
      if (allocs.length === 0) {
        allocationStatus = 'missing_allocation';
        if (!issue) { issue = 'Payment has no allocation to any invoice'; severity = 'critical'; }
      } else {
        const totalAllocated = allocs.reduce((sum, a) => sum + parseFloat(a.amount || 0), 0);
        if (Math.abs(totalAllocated - localAmount) > 0.01) {
          allocationStatus = 'partial_allocation';
          if (!issue) { issue = `Partially allocated: $${totalAllocated.toFixed(2)} of $${localAmount.toFixed(2)}`; severity = severity === 'none' ? 'high' : severity; }
        } else {
          allocationStatus = 'allocated';
        }
      }

      rows.push({
        type: 'payment',
        localId: p.id,
        billingAccountId: p.billingAccountId,
        localStatus: p.status,
        localAmount,
        stripePaymentIntentId: p.stripePaymentIntentId || null,
        stripeStatus,
        stripeAmount,
        stripePaid,
        allocationStatus,
        issue,
        severity,
        createdAt: p.createdAt?.toISOString?.() ?? null,
      });
    }

    // Sort: issues first, then by date desc
    rows.sort((a, b) =>
      (SEV_ORDER[a.severity] ?? 5) - (SEV_ORDER[b.severity] ?? 5) ||
      (b.createdAt || '').localeCompare(a.createdAt || '')
    );

    const counts = {
      total: rows.length,
      critical: rows.filter(r => r.severity === 'critical').length,
      high:     rows.filter(r => r.severity === 'high').length,
      medium:   rows.filter(r => r.severity === 'medium').length,
      none:     rows.filter(r => r.severity === 'none').length,
    };

    res.json({ success: true, rows, counts, stripeAvailable });
  } catch (err) {
    console.error('[billing/reconciliation] error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
