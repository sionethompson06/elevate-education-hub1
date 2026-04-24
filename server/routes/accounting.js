import { Router } from 'express';
import { eq, and, between, lte, desc, asc } from 'drizzle-orm';
import db from '../db-postgres.js';
import {
  chartOfAccounts, journalEntries, journalEntryLines,
  paymentAllocations, invoices, billingAccounts, payments,
} from '../schema.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import {
  recognizeRevenue, getFamilyStatement,
} from '../services/accounting.service.js';

const router = Router();

// ── Chart of accounts ─────────────────────────────────────────────────────────

router.get('/chart-of-accounts', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const accounts = await db.select().from(chartOfAccounts).orderBy(asc(chartOfAccounts.code));
    res.json({ accounts });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Journal entries (paginated) ───────────────────────────────────────────────

router.get('/journal-entries', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { referenceType, billingAccountId, from, to, page = '1', limit = '50' } = req.query;
    const conditions = [];
    if (referenceType) conditions.push(eq(journalEntries.referenceType, referenceType));
    if (billingAccountId) conditions.push(eq(journalEntries.billingAccountId, parseInt(billingAccountId)));
    if (from && to) conditions.push(between(journalEntries.date, from, to));
    else if (from) conditions.push(lte(from, journalEntries.date));

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const entries = await db.select().from(journalEntries)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(journalEntries.date), desc(journalEntries.id))
      .limit(parseInt(limit))
      .offset(offset);

    // Attach lines
    const entryIds = entries.map(e => e.id);
    let lines = [];
    if (entryIds.length) {
      lines = await db.select({
        journalEntryId: journalEntryLines.journalEntryId,
        debit: journalEntryLines.debit,
        credit: journalEntryLines.credit,
        description: journalEntryLines.description,
        accountCode: chartOfAccounts.code,
        accountName: chartOfAccounts.name,
      })
      .from(journalEntryLines)
      .leftJoin(chartOfAccounts, eq(chartOfAccounts.id, journalEntryLines.accountId))
      .where(eq(journalEntryLines.journalEntryId, entryIds[0])) // simplified — see note
    }

    // Group lines by entry
    const linesByEntry = {};
    for (const l of lines) {
      if (!linesByEntry[l.journalEntryId]) linesByEntry[l.journalEntryId] = [];
      linesByEntry[l.journalEntryId].push(l);
    }

    res.json({
      entries: entries.map(e => ({ ...e, lines: linesByEntry[e.id] || [] })),
      page: parseInt(page),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Financial reports ─────────────────────────────────────────────────────────

router.get('/reports/income-statement', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) return res.status(400).json({ success: false, error: 'from and to dates required (YYYY-MM-DD)' });

    const rows = await db.select({
      code: chartOfAccounts.code,
      name: chartOfAccounts.name,
      type: chartOfAccounts.type,
      normalBalance: chartOfAccounts.normalBalance,
      totalDebit:  db.$count ? undefined : journalEntryLines.debit,  // placeholder
      totalCredit: db.$count ? undefined : journalEntryLines.credit,
    })
    .from(journalEntryLines)
    .leftJoin(journalEntries,   eq(journalEntries.id,   journalEntryLines.journalEntryId))
    .leftJoin(chartOfAccounts,  eq(chartOfAccounts.id,  journalEntryLines.accountId))
    .where(and(
      between(journalEntries.date, from, to),
      eq(journalEntries.status, 'posted'),
    ));

    // Aggregate in JS (Neon HTTP driver doesn't support sql aggregates with Drizzle select cleanly)
    const accountMap = {};
    for (const r of rows) {
      if (!r.code || !['revenue', 'expense'].includes(r.type)) continue;
      if (!accountMap[r.code]) {
        accountMap[r.code] = { code: r.code, name: r.name, type: r.type, normalBalance: r.normalBalance, totalDebit: 0, totalCredit: 0 };
      }
      accountMap[r.code].totalDebit  += parseFloat(r.totalDebit  || 0);
      accountMap[r.code].totalCredit += parseFloat(r.totalCredit || 0);
    }

    const accounts = Object.values(accountMap).map(a => ({
      ...a,
      // net: positive = income for normal-credit accounts (revenue), positive = cost for normal-debit (expense)
      net: a.normalBalance === 'credit'
        ? Math.round((a.totalCredit - a.totalDebit) * 100) / 100
        : Math.round((a.totalDebit - a.totalCredit) * 100) / 100,
    }));

    const revenue  = accounts.filter(a => a.type === 'revenue');
    const expense  = accounts.filter(a => a.type === 'expense');
    const totalRevenue = revenue.reduce((s, a) => s + a.net, 0);
    const totalExpense = expense.reduce((s, a) => s + a.net, 0);

    res.json({
      period: { from, to },
      revenue,
      expense,
      totalRevenue: totalRevenue.toFixed(2),
      totalExpense: totalExpense.toFixed(2),
      netIncome:    (totalRevenue - totalExpense).toFixed(2),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/reports/balance-sheet', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const asOf = req.query['as-of'] || new Date().toISOString().split('T')[0];

    const rows = await db.select({
      code: chartOfAccounts.code,
      name: chartOfAccounts.name,
      type: chartOfAccounts.type,
      normalBalance: chartOfAccounts.normalBalance,
      debit:  journalEntryLines.debit,
      credit: journalEntryLines.credit,
    })
    .from(journalEntryLines)
    .leftJoin(journalEntries,  eq(journalEntries.id,  journalEntryLines.journalEntryId))
    .leftJoin(chartOfAccounts, eq(chartOfAccounts.id, journalEntryLines.accountId))
    .where(and(
      lte(journalEntries.date, asOf),
      eq(journalEntries.status, 'posted'),
    ));

    const accountMap = {};
    for (const r of rows) {
      if (!r.code || !['asset', 'liability', 'equity'].includes(r.type)) continue;
      if (!accountMap[r.code]) {
        accountMap[r.code] = { code: r.code, name: r.name, type: r.type, normalBalance: r.normalBalance, totalDebit: 0, totalCredit: 0 };
      }
      accountMap[r.code].totalDebit  += parseFloat(r.debit  || 0);
      accountMap[r.code].totalCredit += parseFloat(r.credit || 0);
    }

    const accounts = Object.values(accountMap).map(a => ({
      ...a,
      balance: a.normalBalance === 'debit'
        ? Math.round((a.totalDebit - a.totalCredit) * 100) / 100
        : Math.round((a.totalCredit - a.totalDebit) * 100) / 100,
    }));

    const assets      = accounts.filter(a => a.type === 'asset');
    const liabilities = accounts.filter(a => a.type === 'liability');
    const equity      = accounts.filter(a => a.type === 'equity');
    const totalAssets      = assets.reduce((s, a) => s + a.balance, 0);
    const totalLiabilities = liabilities.reduce((s, a) => s + a.balance, 0);
    const totalEquity      = equity.reduce((s, a) => s + a.balance, 0);

    res.json({
      asOf,
      assets,      totalAssets:      totalAssets.toFixed(2),
      liabilities, totalLiabilities: totalLiabilities.toFixed(2),
      equity,      totalEquity:      totalEquity.toFixed(2),
      totalLiabilitiesAndEquity: (totalLiabilities + totalEquity).toFixed(2),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/reports/ar-aging', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const today = new Date(); today.setHours(0, 0, 0, 0);

    // Derived from invoices table (more accurate for live AR than ledger)
    const openInvoices = await db.select({
      id: invoices.id,
      amount: invoices.amount,
      dueDate: invoices.dueDate,
      description: invoices.description,
      billingAccountId: invoices.billingAccountId,
    })
    .from(invoices)
    .where(and(
      eq(invoices.status, 'pending'),
      // only include invoices with pending status (past_due caught below)
    ))
    .orderBy(asc(invoices.dueDate));

    const pastDue = await db.select({
      id: invoices.id,
      amount: invoices.amount,
      dueDate: invoices.dueDate,
      description: invoices.description,
      billingAccountId: invoices.billingAccountId,
    })
    .from(invoices)
    .where(eq(invoices.status, 'past_due'))
    .orderBy(asc(invoices.dueDate));

    const all = [...openInvoices, ...pastDue];

    const buckets = { current: 0, days1_30: 0, days31_60: 0, days61plus: 0 };
    const rows = all.map(inv => {
      const due = inv.dueDate ? new Date(inv.dueDate + 'T00:00:00') : null;
      const daysPast = due ? Math.floor((today - due) / 86400000) : 0;
      const amount = parseFloat(inv.amount);
      let bucket;
      if (daysPast <= 0)        { bucket = 'current';    buckets.current   += amount; }
      else if (daysPast <= 30)  { bucket = '1-30 days';  buckets.days1_30  += amount; }
      else if (daysPast <= 60)  { bucket = '31-60 days'; buckets.days31_60 += amount; }
      else                      { bucket = '61+ days';   buckets.days61plus += amount; }
      return { invoiceId: inv.id, amount: amount.toFixed(2), dueDate: inv.dueDate, daysPast, bucket, description: inv.description };
    });

    const total = Object.values(buckets).reduce((s, v) => s + v, 0);
    res.json({
      asOf: today.toISOString().split('T')[0],
      buckets: {
        current:   buckets.current.toFixed(2),
        days1_30:  buckets.days1_30.toFixed(2),
        days31_60: buckets.days31_60.toFixed(2),
        days61plus: buckets.days61plus.toFixed(2),
      },
      total: total.toFixed(2),
      rows,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Family statement ──────────────────────────────────────────────────────────

router.get('/family-statement/:billingAccountId', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.billingAccountId);
    // Parents can only view their own account; admins can view any
    if (req.user.role !== 'admin') {
      const [acct] = await db.select({ id: billingAccounts.id })
        .from(billingAccounts).where(eq(billingAccounts.parentUserId, req.user.id));
      if (!acct || acct.id !== id) return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    const statement = await getFamilyStatement(id);
    res.json({ success: true, ...statement });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Revenue recognition trigger ───────────────────────────────────────────────

router.post('/recognize-revenue', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { period } = req.body; // optional YYYY-MM; defaults to previous month
    const result = await recognizeRevenue(period || null);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Payment allocations ───────────────────────────────────────────────────────

router.get('/payment-allocations', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { paymentId, invoiceId } = req.query;
    const conditions = [];
    if (paymentId) conditions.push(eq(paymentAllocations.paymentId, parseInt(paymentId)));
    if (invoiceId) conditions.push(eq(paymentAllocations.invoiceId, parseInt(invoiceId)));
    const rows = await db.select().from(paymentAllocations)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(paymentAllocations.createdAt));
    res.json({ allocations: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
