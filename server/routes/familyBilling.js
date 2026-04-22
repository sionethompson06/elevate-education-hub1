import { Router } from 'express';
import { eq, desc, inArray, and } from 'drizzle-orm';
import db from '../db-postgres.js';
import {
  familyInvoices, invoices, enrollments, programs, students,
  billingAccounts, users, payments,
} from '../schema.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { logAudit } from '../services/audit.service.js';

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
        eq(invoices.status, 'pending')
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
          eq(familyInvoices.status, 'pending')
        ));
      familyInvoice = existing || null;
    }

    const totalAmount = pendingInvoices.reduce(
      (sum, inv) => sum + parseFloat(inv.amount || 0), 0
    );

    if (familyInvoice) {
      // Refresh the total in case overrides changed amounts
      [familyInvoice] = await db.update(familyInvoices)
        .set({ totalAmount: String(totalAmount) })
        .where(eq(familyInvoices.id, familyInvoice.id))
        .returning();
    } else {
      // Create a new consolidated family invoice
      const dueDate = pendingInvoices[0].dueDate
        || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      [familyInvoice] = await db.insert(familyInvoices).values({
        billingAccountId: billingAccount.id,
        totalAmount: String(totalAmount),
        status: 'pending',
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

    const familyInvoiceIds = fiList.map(fi => fi.id);

    // Fetch child invoices
    const childInvoices = await db.select().from(invoices)
      .where(inArray(invoices.familyInvoiceId, familyInvoiceIds))
      .orderBy(desc(invoices.createdAt));

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

    // Assemble enriched result
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

      const parent = parentByAccountId[fi.billingAccountId] || null;
      return {
        ...fi,
        lineItems,
        payments: paymentsByFi[fi.id] || [],
        parentName: parent ? `${parent.firstName} ${parent.lastName}` : null,
        parentEmail: parent?.email || null,
      };
    });

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
    await db.insert(payments).values({
      billingAccountId: fi.billingAccountId,
      invoiceId: childInvs[0]?.id || null,
      amount: String(fi.totalAmount),
      method: 'manual',
      status: 'paid',
      processedAt: new Date(),
    });

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

export default router;
