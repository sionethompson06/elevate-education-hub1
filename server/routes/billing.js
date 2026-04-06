import { Router } from 'express';
import { eq, desc, and } from 'drizzle-orm';
import db from '../db-postgres.js';
import { billingAccounts, invoices, payments, enrollments, students, programs } from '../schema.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { logAudit } from '../services/audit.service.js';
import { createNotification } from '../services/notification.service.js';

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
    let accountFilter;
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
        createdAt: invoices.createdAt,
      }).from(invoices).orderBy(desc(invoices.createdAt));
      return res.json({ success: true, invoices: allInvoices });
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
      createdAt: invoices.createdAt,
    }).from(invoices)
      .where(eq(invoices.billingAccountId, account.id))
      .orderBy(desc(invoices.createdAt));
    res.json({ success: true, invoices: myInvoices });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/payments', requireAuth, async (req, res) => {
  try {
    if (req.user.role === 'admin') {
      const allPayments = await db.select().from(payments).orderBy(desc(payments.createdAt));
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

export default router;
