import { Router } from 'express';
import { eq, desc, inArray, and, sql } from 'drizzle-orm';
import db from '../db-postgres.js';
import { billingAccounts, invoices, familyInvoices, payments, enrollments, students, programs, guardianStudents, users, paymentAllocations } from '../schema.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { logAudit } from '../services/audit.service.js';
import { createNotification } from '../services/notification.service.js';
import { broadcastEvent } from '../services/sse.service.js';
import { recordPaymentReceived, recordWaiver, allocatePayment } from '../services/accounting.service.js';

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

export default router;
