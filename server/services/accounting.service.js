import { eq, and, inArray, lte, gte, isNotNull, sum, sql } from 'drizzle-orm';
import db from '../db-postgres.js';
import {
  chartOfAccounts, journalEntries, journalEntryLines, paymentAllocations,
  invoices, payments, enrollments, programs, billingAccounts, users, students, guardianStudents,
} from '../schema.js';

// ── Internal helpers ──────────────────────────────────────────────────────────

async function getAccountByCode(code) {
  const [acct] = await db.select().from(chartOfAccounts).where(eq(chartOfAccounts.code, code));
  if (!acct) throw new Error(`Chart of accounts: code ${code} not found`);
  return acct;
}

function today() {
  return new Date().toISOString().split('T')[0];
}

// ── Core double-entry writer ──────────────────────────────────────────────────

/**
 * Insert a balanced journal entry + lines.
 * Returns the existing entry silently if idempotencyKey already used.
 * Throws if debits ≠ credits.
 */
export async function createJournalEntry({
  date,
  description,
  referenceType,
  referenceId,
  idempotencyKey,
  billingAccountId,
  enrollmentId,
  createdBy = null,
  lines, // [{ accountCode, debit, credit, description? }]
}) {
  // Validate balance
  const totalDebits  = lines.reduce((s, l) => s + parseFloat(l.debit  || 0), 0);
  const totalCredits = lines.reduce((s, l) => s + parseFloat(l.credit || 0), 0);
  if (Math.abs(totalDebits - totalCredits) > 0.005) {
    throw new Error(`Unbalanced journal entry: debits ${totalDebits} ≠ credits ${totalCredits}`);
  }

  // Idempotency check
  if (idempotencyKey) {
    const [existing] = await db.select({ id: journalEntries.id })
      .from(journalEntries)
      .where(eq(journalEntries.idempotencyKey, idempotencyKey));
    if (existing) return existing;
  }

  // Resolve account IDs
  const resolvedLines = await Promise.all(lines.map(async (l) => {
    const acct = await getAccountByCode(l.accountCode);
    return { accountId: acct.id, debit: String(l.debit || 0), credit: String(l.credit || 0), description: l.description || null };
  }));

  // Insert header
  let entry;
  try {
    [entry] = await db.insert(journalEntries).values({
      date: date || today(),
      description,
      referenceType: referenceType || null,
      referenceId: referenceId || null,
      idempotencyKey: idempotencyKey || null,
      billingAccountId: billingAccountId || null,
      enrollmentId: enrollmentId || null,
      createdBy,
    }).returning();
  } catch (err) {
    // Unique violation on idempotencyKey — treat as success
    if (err.code === '23505') {
      const [existing] = await db.select({ id: journalEntries.id })
        .from(journalEntries)
        .where(eq(journalEntries.idempotencyKey, idempotencyKey));
      return existing;
    }
    throw err;
  }

  // Insert lines
  await db.insert(journalEntryLines).values(
    resolvedLines.map(l => ({ ...l, journalEntryId: entry.id }))
  );

  return entry;
}

// ── Event recorders ───────────────────────────────────────────────────────────

/** DR Accounts Receivable (1100) / CR Deferred Revenue (2000) */
export async function recordInvoiceCreated(invoice, enrollmentId, billingAccountId) {
  const amount = parseFloat(invoice.amount);
  if (!amount || amount <= 0) return;
  await createJournalEntry({
    date: invoice.createdAt ? new Date(invoice.createdAt).toISOString().split('T')[0] : today(),
    description: `Invoice created: ${invoice.description || 'Tuition'}`,
    referenceType: 'invoice',
    referenceId: invoice.id,
    idempotencyKey: `invoice:${invoice.id}`,
    billingAccountId,
    enrollmentId,
    lines: [
      { accountCode: '1100', debit: amount, credit: 0 },
      { accountCode: '2000', debit: 0, credit: amount },
    ],
  });
}

/**
 * DR Cash (1000) for manual payments.
 * DR Stripe Clearing (1050) for Stripe payments (T+2 settlement).
 * CR Accounts Receivable (1100)
 */
export async function recordPaymentReceived(payment) {
  const amount = parseFloat(payment.amount);
  if (!amount || amount <= 0) return;
  const isStripe = payment.method === 'stripe' || !!payment.stripePaymentIntentId;
  const cashAccount = isStripe ? '1050' : '1000';
  await createJournalEntry({
    date: payment.processedAt ? new Date(payment.processedAt).toISOString().split('T')[0] : today(),
    description: `Payment received (${payment.method || 'manual'})`,
    referenceType: 'payment',
    referenceId: payment.id,
    idempotencyKey: `payment:${payment.id}`,
    billingAccountId: payment.billingAccountId,
    lines: [
      { accountCode: cashAccount, debit: amount, credit: 0 },
      { accountCode: '1100', debit: 0, credit: amount },
    ],
  });
}

/**
 * DR Scholarship Allowance (4900 — contra-revenue) / CR Accounts Receivable (1100)
 * waivedAmount must be the remaining AR balance (after any prior allocations), not the original invoice amount.
 */
export async function recordWaiver(invoice, waivedAmount) {
  const amount = parseFloat(waivedAmount);
  if (!amount || amount <= 0) return;
  await createJournalEntry({
    date: today(),
    description: `Waiver applied: ${invoice.description || 'Tuition'}`,
    referenceType: 'waiver',
    referenceId: invoice.id,
    idempotencyKey: `waiver:${invoice.id}`,
    billingAccountId: invoice.billingAccountId,
    enrollmentId: invoice.enrollmentId,
    lines: [
      { accountCode: '4900', debit: amount, credit: 0 },
      { accountCode: '1100', debit: 0, credit: amount },
    ],
  });
}

/**
 * Correcting entry when admin changes an existing invoice's amount.
 * delta > 0: charge increased → DR AR / CR Deferred Revenue
 * delta < 0: charge reduced  → DR Deferred Revenue / CR AR
 */
export async function recordInvoiceAdjustment(invoiceId, oldAmount, newAmount, billingAccountId, enrollmentId) {
  const delta = Math.round((parseFloat(newAmount) - parseFloat(oldAmount)) * 100) / 100;
  if (Math.abs(delta) < 0.005) return;
  const key = `adjustment:${invoiceId}:${newAmount}`;
  if (delta > 0) {
    await createJournalEntry({
      date: today(),
      description: `Invoice adjustment +$${delta.toFixed(2)}`,
      referenceType: 'adjustment',
      referenceId: invoiceId,
      idempotencyKey: key,
      billingAccountId,
      enrollmentId,
      lines: [
        { accountCode: '1100', debit: delta, credit: 0 },
        { accountCode: '2000', debit: 0, credit: delta },
      ],
    });
  } else {
    const abs = Math.abs(delta);
    await createJournalEntry({
      date: today(),
      description: `Invoice adjustment -$${abs.toFixed(2)}`,
      referenceType: 'adjustment',
      referenceId: invoiceId,
      idempotencyKey: key,
      billingAccountId,
      enrollmentId,
      lines: [
        { accountCode: '2000', debit: abs, credit: 0 },
        { accountCode: '1100', debit: 0, credit: abs },
      ],
    });
  }
}

// ── Revenue recognition ───────────────────────────────────────────────────────

function monthsBetween(startStr, endStr) {
  const s = new Date(startStr + 'T00:00:00');
  const e = new Date(endStr   + 'T00:00:00');
  return Math.max(1, (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth()) + 1);
}

/**
 * Recognize revenue for a given period (YYYY-MM).
 * Defaults to the previous calendar month.
 * Monthly-billed enrollments: recognize full invoice.amount for the period.
 * Annual-billed enrollments: recognize invoice.amount / totalMonths.
 */
export async function recognizeRevenue(period = null) {
  let targetPeriod = period;
  if (!targetPeriod) {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    targetPeriod = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
  const [year, month] = targetPeriod.split('-').map(Number);
  const periodStart = new Date(year, month - 1, 1).toISOString().split('T')[0];
  const periodEnd   = new Date(year, month, 0).toISOString().split('T')[0]; // last day

  // Batch fetch all qualifying enrollments with their latest invoice amount
  const rows = await db.select({
    enrollmentId: enrollments.id,
    billingAccountId: invoices.billingAccountId,
    startDate: enrollments.startDate,
    endDate: enrollments.endDate,
    billingCycle: enrollments.billingCycleOverride,
    programCycle: programs.billingCycle,
    invoiceAmount: invoices.amount,
    programName: programs.name,
  })
  .from(enrollments)
  .leftJoin(programs, eq(enrollments.programId, programs.id))
  .leftJoin(invoices, eq(invoices.enrollmentId, enrollments.id))
  .where(and(
    inArray(enrollments.status, ['active', 'active_override']),
    isNotNull(enrollments.startDate),
    isNotNull(enrollments.endDate),
    lte(enrollments.startDate, periodEnd),
    gte(enrollments.endDate, periodStart),
  ));

  let recognized = 0;
  let skipped = 0;

  for (const row of rows) {
    if (!row.invoiceAmount || parseFloat(row.invoiceAmount) <= 0) { skipped++; continue; }
    const idempotencyKey = `recognition:${row.enrollmentId}:${targetPeriod}`;
    const cycle = row.billingCycle || row.programCycle || 'monthly';
    const monthlyAmount = cycle === 'monthly'
      ? parseFloat(row.invoiceAmount)
      : Math.round((parseFloat(row.invoiceAmount) / monthsBetween(row.startDate, row.endDate)) * 100) / 100;

    try {
      const result = await createJournalEntry({
        date: periodEnd,
        description: `Revenue recognition — ${row.programName || 'Tuition'} — ${targetPeriod}`,
        referenceType: 'recognition',
        referenceId: row.enrollmentId,
        idempotencyKey,
        billingAccountId: row.billingAccountId,
        enrollmentId: row.enrollmentId,
        lines: [
          { accountCode: '2000', debit: monthlyAmount, credit: 0, description: 'Deferred Revenue release' },
          { accountCode: '4000', debit: 0, credit: monthlyAmount, description: 'Tuition Revenue earned' },
        ],
      });
      // If entry already existed, result has id but was pre-existing
      recognized++;
    } catch {
      skipped++;
    }
  }

  return { period: targetPeriod, recognized, skipped };
}

// ── Payment allocation ────────────────────────────────────────────────────────

/**
 * Link a payment to invoice(s), tracking partial payments.
 * Overpayment remainder → billingAccounts.balance (credit store).
 * Idempotent: skips if allocations already exist for this paymentId.
 */
export async function allocatePayment(paymentId) {
  const [payment] = await db.select().from(payments).where(eq(payments.id, paymentId));
  if (!payment) throw new Error(`Payment ${paymentId} not found`);

  // Idempotency: skip if already allocated
  const existing = await db.select({ id: paymentAllocations.id })
    .from(paymentAllocations)
    .where(eq(paymentAllocations.paymentId, paymentId));
  if (existing.length > 0) return;

  let remaining = Math.round(parseFloat(payment.amount) * 100); // work in cents

  const allocate = async (invoiceId, invoiceAmountCents) => {
    if (remaining <= 0) return;
    // Existing allocations against this invoice
    const [allocated] = await db.select({ total: sum(paymentAllocations.amount) })
      .from(paymentAllocations)
      .where(eq(paymentAllocations.invoiceId, invoiceId));
    const alreadyCents = Math.round(parseFloat(allocated?.total || 0) * 100);
    const balanceCents = invoiceAmountCents - alreadyCents;
    if (balanceCents <= 0) return;
    const toCents = Math.min(remaining, balanceCents);
    await db.insert(paymentAllocations).values({
      paymentId,
      invoiceId,
      amount: String(toCents / 100),
    }).onConflictDoNothing();
    remaining -= toCents;
  };

  if (payment.invoiceId) {
    const [inv] = await db.select({ amount: invoices.amount }).from(invoices).where(eq(invoices.id, payment.invoiceId));
    if (inv) await allocate(payment.invoiceId, Math.round(parseFloat(inv.amount) * 100));
  } else {
    // Allocate oldest-first across all pending/past_due invoices for this billing account
    const pendingInvs = await db.select({ id: invoices.id, amount: invoices.amount })
      .from(invoices)
      .where(and(
        eq(invoices.billingAccountId, payment.billingAccountId),
        inArray(invoices.status, ['pending', 'past_due'])
      ))
      .orderBy(invoices.dueDate);
    for (const inv of pendingInvs) {
      await allocate(inv.id, Math.round(parseFloat(inv.amount) * 100));
    }
  }

  // Overpayment → credit on billing account
  if (remaining > 0) {
    const credit = remaining / 100;
    await db.update(billingAccounts)
      .set({ balance: sql`balance + ${String(credit)}` })
      .where(eq(billingAccounts.id, payment.billingAccountId));
  }
}

// ── Family financial statement ────────────────────────────────────────────────

/**
 * Running balance statement for a billing account, derived from journal entries.
 * Returns charges, payments, adjustments and waivers in date order.
 */
export async function getFamilyStatement(billingAccountId) {
  const [acct] = await db.select({
    balance: billingAccounts.balance,
    parentUserId: billingAccounts.parentUserId,
  }).from(billingAccounts).where(eq(billingAccounts.id, billingAccountId));

  if (!acct) throw new Error('Billing account not found');

  // Fetch all journal entries for this account with their lines
  const entryRows = await db.select({
    entryId: journalEntries.id,
    date: journalEntries.date,
    description: journalEntries.description,
    referenceType: journalEntries.referenceType,
    debit: journalEntryLines.debit,
    credit: journalEntryLines.credit,
    accountCode: chartOfAccounts.code,
    accountType: chartOfAccounts.type,
  })
  .from(journalEntries)
  .leftJoin(journalEntryLines, eq(journalEntryLines.journalEntryId, journalEntries.id))
  .leftJoin(chartOfAccounts, eq(chartOfAccounts.id, journalEntryLines.accountId))
  .where(eq(journalEntries.billingAccountId, billingAccountId))
  .orderBy(journalEntries.date, journalEntries.id);

  // Summarize per entry: net AR impact (positive = charge, negative = payment/reduction)
  const entryMap = {};
  for (const r of entryRows) {
    if (!entryMap[r.entryId]) {
      entryMap[r.entryId] = { date: r.date, description: r.description, type: r.referenceType, netAR: 0 };
    }
    if (r.accountCode === '1100') { // Accounts Receivable
      entryMap[r.entryId].netAR += parseFloat(r.debit || 0) - parseFloat(r.credit || 0);
    }
  }

  let runningBalance = 0;
  let totalCharges = 0, totalPayments = 0, totalAdjustments = 0;
  const lines = Object.values(entryMap).map(e => {
    const amount = Math.round(e.netAR * 100) / 100;
    runningBalance = Math.round((runningBalance + amount) * 100) / 100;
    if (e.type === 'invoice') totalCharges += amount;
    else if (e.type === 'payment') totalPayments += Math.abs(amount);
    else totalAdjustments += amount;
    return {
      date: e.date,
      type: e.type,
      description: e.description,
      amount: amount.toFixed(2),
      balance: runningBalance.toFixed(2),
    };
  });

  const [parentUser] = await db.select({ firstName: users.firstName, lastName: users.lastName })
    .from(users).where(eq(users.id, acct.parentUserId));

  return {
    billingAccountId,
    parentName: parentUser ? `${parentUser.firstName} ${parentUser.lastName}` : null,
    creditBalance: parseFloat(acct.balance || 0).toFixed(2),
    beginningBalance: '0.00',
    totalCharges: totalCharges.toFixed(2),
    totalPayments: totalPayments.toFixed(2),
    totalAdjustments: totalAdjustments.toFixed(2),
    endingBalance: runningBalance.toFixed(2),
    statement: lines,
  };
}
