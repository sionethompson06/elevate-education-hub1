import { Router } from 'express';
import { eq, desc, inArray, and, lt } from 'drizzle-orm';
import db from '../db-postgres.js';
import {
  familyInvoices, invoices, enrollments, programs, students,
  billingAccounts, users, payments,
} from '../schema.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { logAudit } from '../services/audit.service.js';
import { recordPaymentReceived, allocatePayment } from '../services/accounting.service.js';

const router = Router();

// ── Helpers ────────────────────────────────────────────────────────────────────

async function enrichInvoicesWithEnrollmentInfo(pendingInvoices) {
  const enrollmentIds = [...new Set(
    pendingInvoices.filter(i => i.enrollmentId).map(i => i.enrollmentId)
  )];
  let enrollmentMap = {};
  if (enrollmentIds.length > 0) {
    const rows = await db.select({
      id: enrollments.id,
      programName: programs.name,
      studentFirstName: students.firstName,
      studentLastName: students.lastName,
    }).from(enrollments)
      .leftJoin(programs, eq(enrollments.programId, programs.id))
      .leftJoin(students, eq(enrollments.studentId, students.id))
      .where(inArray(enrollments.id, enrollmentIds));
    enrollmentMap = Object.fromEntries(rows.map(r => [r.id, r]));
  }
  return pendingInvoices.map(inv => {
    const e = inv.enrollmentId ? enrollmentMap[inv.enrollmentId] : null;
    return {
      invoiceId: inv.id,
      enrollmentId: inv.enrollmentId,
      description: inv.description,
      amount: inv.amount,
      invoiceStatus: inv.status,
      programName: e?.programName || null,
      studentFirstName: e?.studentFirstName || null,
      studentLastName: e?.studentLastName || null,
    };
  });
}

// ── POST /api/billing/family-invoice ──────────────────────────────────────────
// Creates or refreshes a consolidated family invoice grouping all pending invoices.
// If a pending family invoice already exists, reuses it and recalculates the total.
router.post('/family-invoice', requireAuth, async (req, res) => {
  try {
    const { enrollmentIds } = req.body;

    const [billingAccount] = await db.select().from(billingAccounts)
      .where(eq(billingAccounts.parentUserId, req.user.id));
    if (!billingAccount) {
      return res.status(404).json({ success: false, error: 'No billing account found.' });
    }

    // Load all pending invoices for this billing account
    let pendingInvoices = await db.select().from(invoices)
      .where(and(
        eq(invoices.billingAccountId, billingAccount.id),
        inArray(invoices.status, ['pending', 'past_due'])
      ))
      .orderBy(desc(invoices.createdAt));

    // If caller specified specific enrollment IDs, filter to those
    if (enrollmentIds && enrollmentIds.length > 0) {
      const ids = enrollmentIds.map(Number);
      pendingInvoices = pendingInvoices.filter(inv =>
        inv.enrollmentId && ids.includes(inv.enrollmentId)
      );
    }

    if (pendingInvoices.length === 0) {
      return res.status(400).json({ success: false, error: 'No pending invoices to consolidate.' });
    }

    // Look for an existing pending family invoice to reuse
    const existingFiIds = [...new Set(
      pendingInvoices.filter(inv => inv.familyInvoiceId).map(inv => inv.familyInvoiceId)
    )];

    let familyInvoice = null;
    if (existingFiIds.length > 0) {
      const [existing] = await db.select().from(familyInvoices)
        .where(and(
          eq(familyInvoices.id, existingFiIds[0]),
          inArray(familyInvoices.status, ['pending', 'past_due'])
        ));
      familyInvoice = existing || null;
    }

    const totalAmount = pendingInvoices.reduce(
      (sum, inv) => sum + parseFloat(inv.amount || 0), 0
    );

    const anyPastDue = pendingInvoices.some(inv => inv.status === 'past_due');

    if (familyInvoice) {
      // Refresh the total; also promote to past_due if any child is already overdue
      const updateFields = { totalAmount: String(totalAmount) };
      if (anyPastDue && familyInvoice.status !== 'past_due') {
        updateFields.status = 'past_due';
      }
      [familyInvoice] = await db.update(familyInvoices)
        .set(updateFields)
        .where(eq(familyInvoices.id, familyInvoice.id))
        .returning();
    } else {
      // Create a new consolidated family invoice — use the earliest (most urgent) child dueDate
      const sortedByDue = pendingInvoices
        .filter(i => i.dueDate)
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
      const dueDate = sortedByDue[0]?.dueDate
        || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      [familyInvoice] = await db.insert(familyInvoices).values({
        billingAccountId: billingAccount.id,
        totalAmount: String(totalAmount),
        status: anyPastDue ? 'past_due' : 'pending',
        dueDate,
      }).returning();
    }

    // Link all pending invoices to this family invoice
    const invoiceIds = pendingInvoices.map(inv => inv.id);
    await db.update(invoices)
      .set({ familyInvoiceId: familyInvoice.id })
      .where(inArray(invoices.id, invoiceIds));

    const lineItems = await enrichInvoicesWithEnrollmentInfo(pendingInvoices);

    res.json({ success: true, familyInvoice: { ...familyInvoice, lineItems } });
  } catch (err) {
    console.error('[family-billing] create error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/billing/family-invoices ──────────────────────────────────────────
// Returns family invoices with itemized line items and payment history.
// Parents see their own; admins see all.
router.get('/family-invoices', requireAuth, async (req, res) => {
  try {
    let targetAccountIds;

    if (req.user.role === 'admin') {
      const allAccounts = await db.select({ id: billingAccounts.id }).from(billingAccounts);
      targetAccountIds = allAccounts.map(a => a.id);
    } else {
      const [billingAccount] = await db.select().from(billingAccounts)
        .where(eq(billingAccounts.parentUserId, req.user.id));
      if (!billingAccount) return res.json({ success: true, familyInvoices: [] });
      targetAccountIds = [billingAccount.id];
    }

    if (targetAccountIds.length === 0) return res.json({ success: true, familyInvoices: [] });

    const fiList = await db.select().from(familyInvoices)
      .where(inArray(familyInvoices.billingAccountId, targetAccountIds))
      .orderBy(desc(familyInvoices.createdAt));

    if (fiList.length === 0) return res.json({ success: true, familyInvoices: [] });

    // Compute-on-read: lazily mark overdue pending family invoices as past_due
    const today = new Date().toISOString().split('T')[0];
    const nowOverdue = fiList.filter(fi =>
      fi.status === 'pending' && fi.dueDate && fi.dueDate < today
    );
    if (nowOverdue.length > 0) {
      await db.update(familyInvoices)
        .set({ status: 'past_due' })
        .where(inArray(familyInvoices.id, nowOverdue.map(fi => fi.id)));
      nowOverdue.forEach(fi => { fi.status = 'past_due'; });
    }

    const familyInvoiceIds = fiList.map(fi => fi.id);

    // Fetch child invoices
    const childInvoices = await db.select().from(invoices)
      .where(inArray(invoices.familyInvoiceId, familyInvoiceIds))
      .orderBy(desc(invoices.createdAt));

    // Second lazy promotion: if any child invoice is past_due, promote its family invoice too.
    // This catches the case where dueDate is in the future but Stripe already fired a payment
    // failure webhook (e.g. card declined on first attempt within the first 30 days).
    const pendingFiIds = fiList.filter(fi => fi.status === 'pending').map(fi => fi.id);
    if (pendingFiIds.length > 0) {
      const upgradeFiIds = [...new Set(
        childInvoices
          .filter(inv => inv.status === 'past_due' && pendingFiIds.includes(inv.familyInvoiceId))
          .map(inv => inv.familyInvoiceId)
      )];
      if (upgradeFiIds.length > 0) {
        await db.update(familyInvoices)
          .set({ status: 'past_due' })
          .where(inArray(familyInvoices.id, upgradeFiIds));
        fiList.forEach(fi => { if (upgradeFiIds.includes(fi.id)) fi.status = 'past_due'; });
      }
    }

    // Enrich with enrollment/program/student info
    const enrollmentIds = [...new Set(
      childInvoices.filter(i => i.enrollmentId).map(i => i.enrollmentId)
    )];
    let enrollmentMap = {};
    if (enrollmentIds.length > 0) {
      const enrollmentRows = await db.select({
        id: enrollments.id,
        studentId: enrollments.studentId,
        programId: enrollments.programId,
        programName: programs.name,
        studentFirstName: students.firstName,
        studentLastName: students.lastName,
      }).from(enrollments)
        .leftJoin(programs, eq(enrollments.programId, programs.id))
        .leftJoin(students, eq(enrollments.studentId, students.id))
        .where(inArray(enrollments.id, enrollmentIds));
      enrollmentMap = Object.fromEntries(enrollmentRows.map(e => [e.id, e]));
    }

    // Fetch payments for child invoices (deduplicated by payment intent)
    const childInvoiceIds = childInvoices.map(i => i.id);
    const paymentsByFi = {};
    if (childInvoiceIds.length > 0) {
      const paymentRows = await db.select().from(payments)
        .where(inArray(payments.invoiceId, childInvoiceIds))
        .orderBy(desc(payments.createdAt));
      for (const p of paymentRows) {
        const inv = childInvoices.find(i => i.id === p.invoiceId);
        if (!inv?.familyInvoiceId) continue;
        const fiId = inv.familyInvoiceId;
        if (!paymentsByFi[fiId]) paymentsByFi[fiId] = [];
        const alreadyAdded = paymentsByFi[fiId].some(
          x => x.stripePaymentIntentId && x.stripePaymentIntentId === p.stripePaymentIntentId
        );
        if (!alreadyAdded) paymentsByFi[fiId].push(p);
      }
    }

    // For admin: fetch parent names
    let parentByAccountId = {};
    if (req.user.role === 'admin') {
      const accountRows = await db.select({
        id: billingAccounts.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
      }).from(billingAccounts)
        .leftJoin(users, eq(billingAccounts.parentUserId, users.id))
        .where(inArray(billingAccounts.id, targetAccountIds));
      parentByAccountId = Object.fromEntries(accountRows.map(a => [a.id, a]));
    }

    // Assemble enriched result — compute live totalAmount for pending/past_due invoices
    // so that admin billing changes (amount edits, waive, reopen) are always reflected
    // without requiring a separate cascade update.
    const lazyPaidFiIds = [];

    const result = fiList.map(fi => {
      const lineItems = childInvoices
        .filter(inv => inv.familyInvoiceId === fi.id)
        .map(inv => {
          const e = inv.enrollmentId ? enrollmentMap[inv.enrollmentId] : null;
          return {
            invoiceId: inv.id,
            enrollmentId: inv.enrollmentId,
            description: inv.description,
            amount: inv.amount,
            invoiceStatus: inv.status,
            programName: e?.programName || null,
            studentFirstName: e?.studentFirstName || null,
            studentLastName: e?.studentLastName || null,
          };
        });

      let effectiveTotal = fi.totalAmount;
      let effectiveStatus = fi.status;

      if (['pending', 'past_due'].includes(fi.status)) {
        // Recompute outstanding balance from child invoices so admin edits are instant
        const unpaidChildren = lineItems.filter(item =>
          ['pending', 'past_due'].includes(item.invoiceStatus)
        );
        const computedTotal = unpaidChildren.reduce(
          (sum, item) => sum + parseFloat(item.amount || 0), 0
        );
        effectiveTotal = String(computedTotal);

        // If all children are now paid/waived, lazily promote family invoice to paid
        const allChildrenClosed = lineItems.length > 0 &&
          lineItems.every(item => ['paid', 'waived'].includes(item.invoiceStatus));
        if (allChildrenClosed) {
          effectiveStatus = 'paid';
          lazyPaidFiIds.push(fi.id);
        }
      }

      const parent = parentByAccountId[fi.billingAccountId] || null;
      return {
        ...fi,
        totalAmount: effectiveTotal,
        status: effectiveStatus,
        lineItems,
        payments: paymentsByFi[fi.id] || [],
        parentName: parent ? `${parent.firstName} ${parent.lastName}` : null,
        parentEmail: parent?.email || null,
      };
    });

    // Lazy-sync: mark family invoices as paid where all children are closed
    if (lazyPaidFiIds.length > 0) {
      await db.update(familyInvoices)
        .set({ status: 'paid', paidDate: today })
        .where(inArray(familyInvoices.id, lazyPaidFiIds));
    }

    res.json({ success: true, familyInvoices: result });
  } catch (err) {
    console.error('[family-billing] list error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/billing/family-invoice/manual-pay ───────────────────────────────
// Admin manually marks a family invoice as paid (marks all child invoices + enrollments).
router.post('/family-invoice/manual-pay', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { familyInvoiceId } = req.body;
    if (!familyInvoiceId) return res.status(400).json({ success: false, error: 'familyInvoiceId required' });

    const [fi] = await db.select().from(familyInvoices)
      .where(eq(familyInvoices.id, Number(familyInvoiceId)));
    if (!fi) return res.status(404).json({ success: false, error: 'Family invoice not found' });
    if (fi.status === 'paid') return res.status(400).json({ success: false, error: 'Already paid' });

    const today = new Date().toISOString().split('T')[0];
    await db.update(familyInvoices)
      .set({ status: 'paid', paidDate: today })
      .where(eq(familyInvoices.id, fi.id));

    // Mark all child invoices paid + activate enrollments
    const childInvs = await db.select().from(invoices)
      .where(eq(invoices.familyInvoiceId, fi.id));

    for (const inv of childInvs) {
      await db.update(invoices).set({ status: 'paid', paidDate: today }).where(eq(invoices.id, inv.id));
      if (inv.enrollmentId) {
        const [enr] = await db.select().from(enrollments).where(eq(enrollments.id, inv.enrollmentId));
        if (enr) {
          await db.update(enrollments).set({ status: 'active' }).where(eq(enrollments.id, enr.id));
          if (enr.studentId) {
            await db.update(students).set({ status: 'active' }).where(eq(students.id, enr.studentId));
          }
        }
      }
    }

    // Create one payment record for the total
    const [familyPayment] = await db.insert(payments).values({
      billingAccountId: fi.billingAccountId,
      invoiceId: childInvs[0]?.id || null,
      amount: String(fi.totalAmount),
      method: 'manual',
      status: 'paid',
      processedAt: new Date(),
    }).returning();

    // Non-blocking accounting
    if (familyPayment) {
      recordPaymentReceived(familyPayment).catch(err => console.error('[accounting] recordPaymentReceived error:', err.message));
      allocatePayment(familyPayment.id).catch(err => console.error('[accounting] allocatePayment error:', err.message));
    }

    await logAudit({
      userId: req.user.id,
      action: 'update',
      entityType: 'family_invoice',
      entityId: String(fi.id),
      details: { action: 'manual_pay', totalAmount: fi.totalAmount },
      ipAddress: req.ip,
    });

    res.json({ success: true });
  } catch (err) {
    console.error('[family-billing] manual-pay error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/billing/sync-past-due ──────────────────────────────────────────
// Admin: batch-mark all pending invoices and family invoices whose dueDate has passed.
router.post('/sync-past-due', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const updatedInvoices = await db.update(invoices)
      .set({ status: 'past_due' })
      .where(and(eq(invoices.status, 'pending'), lt(invoices.dueDate, today)))
      .returning({ id: invoices.id });
    const updatedFamilyInvoices = await db.update(familyInvoices)
      .set({ status: 'past_due' })
      .where(and(eq(familyInvoices.status, 'pending'), lt(familyInvoices.dueDate, today)))
      .returning({ id: familyInvoices.id });
    res.json({ success: true, updated: updatedInvoices.length + updatedFamilyInvoices.length });
  } catch (err) {
    console.error('[family-billing] sync-past-due error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
