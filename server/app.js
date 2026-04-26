import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import { eq, and, gt, inArray } from 'drizzle-orm';
import db, { rawSql } from './db-postgres.js';
import {
  users, enrollments, students, guardianStudents, coachAssignments,
  lessonAssignments, rewardCatalog, studentPoints, pointTransactions,
  emergencyContacts, cmsContent, programs, invoices, enrollmentOverrides, billingAccounts,
} from './schema.js';
import { requireAdmin } from './middleware/auth.js';

// ── Startup migrations (idempotent — safe to run on every boot) ────────────────

// 1. Normalize legacy 'pending' enrollment status → 'pending_payment'
async function normalizeEnrollmentStatuses() {
  try {
    const result = await db.update(enrollments)
      .set({ status: 'pending_payment' })
      .where(eq(enrollments.status, 'pending'))
      .returning({ id: enrollments.id });
    if (result.length > 0) {
      console.log(`[migration] Normalized ${result.length} enrollment(s): 'pending' → 'pending_payment'`);
    }
  } catch (err) {
    console.error('[migration] normalizeEnrollmentStatuses error:', err.message);
  }
}

// 2. Revert incorrectly activated partial-override enrollments
async function revertPartialOverrideEnrollments() {
  try {
    const broken = await db.select({
      enrollmentId: enrollmentOverrides.enrollmentId,
    }).from(enrollmentOverrides)
      .innerJoin(enrollments, eq(enrollmentOverrides.enrollmentId, enrollments.id))
      .innerJoin(invoices, eq(invoices.enrollmentId, enrollments.id))
      .where(and(
        eq(enrollmentOverrides.isActive, true),
        gt(enrollmentOverrides.amountDueNowCents, 0),
        eq(enrollments.status, 'active_override'),
        eq(invoices.status, 'pending')
      ));

    const ids = [...new Set(broken.map(r => r.enrollmentId))];
    if (ids.length > 0) {
      await db.update(enrollments)
        .set({ status: 'pending_payment' })
        .where(inArray(enrollments.id, ids));
      console.log(`[migration] Reverted ${ids.length} enrollment(s): active_override → pending_payment (unpaid partial override)`);
    }
  } catch (err) {
    console.error('[migration] revertPartialOverrideEnrollments error:', err.message);
  }
}

// 3. Reassign invoices created by admin enrollments to the correct parent billing account
async function fixAdminCreatedInvoiceBillingAccounts() {
  try {
    const badInvoices = await db.select({
      invoiceId: invoices.id,
      enrollmentId: invoices.enrollmentId,
    })
    .from(invoices)
    .innerJoin(billingAccounts, eq(billingAccounts.id, invoices.billingAccountId))
    .innerJoin(users, eq(users.id, billingAccounts.parentUserId))
    .where(inArray(users.role, ['admin', 'academic_coach', 'performance_coach']));

    let fixed = 0;
    for (const inv of badInvoices) {
      if (!inv.enrollmentId) continue;
      const [enrollment] = await db.select({ studentId: enrollments.studentId })
        .from(enrollments).where(eq(enrollments.id, inv.enrollmentId));
      if (!enrollment) continue;
      const [guardianLink] = await db.select().from(guardianStudents)
        .where(eq(guardianStudents.studentId, enrollment.studentId));
      if (!guardianLink) continue;
      let [parentAccount] = await db.select().from(billingAccounts)
        .where(eq(billingAccounts.parentUserId, guardianLink.guardianUserId));
      if (!parentAccount) {
        [parentAccount] = await db.insert(billingAccounts)
          .values({ parentUserId: guardianLink.guardianUserId }).returning();
      }
      await db.update(invoices)
        .set({ billingAccountId: parentAccount.id })
        .where(eq(invoices.id, inv.invoiceId));
      fixed++;
    }
    if (fixed > 0) {
      console.log(`[migration] Reassigned ${fixed} invoice(s) from admin billing accounts to parent billing accounts`);
    }
  } catch (err) {
    console.error('[migration] fixAdminCreatedInvoiceBillingAccounts error:', err.message);
  }
}

// 4. Create enrollment_overrides table if it doesn't exist
async function ensureOverridesTable() {
  try {
    await rawSql`
      CREATE TABLE IF NOT EXISTS enrollment_overrides (
        id                    SERIAL PRIMARY KEY,
        enrollment_id         INTEGER NOT NULL REFERENCES enrollments(id),
        override_type         VARCHAR(50) NOT NULL,
        reason                TEXT NOT NULL,
        amount_waived_cents   INTEGER NOT NULL DEFAULT 0,
        amount_deferred_cents INTEGER NOT NULL DEFAULT 0,
        amount_due_now_cents  INTEGER NOT NULL DEFAULT 0,
        effective_start_at    DATE,
        effective_end_at      DATE,
        is_active             BOOLEAN NOT NULL DEFAULT TRUE,
        approved_by_user_id   INTEGER REFERENCES users(id),
        approved_by_name      VARCHAR(200),
        approved_at           TIMESTAMP NOT NULL DEFAULT NOW(),
        revoked_at            TIMESTAMP,
        revoke_reason         TEXT,
        notes                 TEXT,
        created_at            TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `;
    console.log('[migration] enrollment_overrides table ready');
  } catch (err) {
    console.error('[migration] ensureOverridesTable error:', err.message);
  }
}

// 3. Add submission_content column to assignment_submissions if missing
async function ensureSubmissionContentColumn() {
  try {
    await rawSql`ALTER TABLE assignment_submissions ADD COLUMN IF NOT EXISTS submission_content TEXT`;
    await rawSql`ALTER TABLE assignment_submissions ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP`;
    console.log('[migration] assignment_submissions submission columns ready');
  } catch (err) {
    console.error('[migration] ensureSubmissionContentColumn error:', err.message);
  }
}

// 4. Create student_medical_info table if it doesn't exist
async function ensureMedicalInfoTable() {
  try {
    await rawSql`
      CREATE TABLE IF NOT EXISTS student_medical_info (
        id                    SERIAL PRIMARY KEY,
        student_id            INTEGER NOT NULL UNIQUE REFERENCES students(id),
        allergies             TEXT,
        medications           TEXT,
        medical_conditions    TEXT,
        doctor_name           VARCHAR(200),
        doctor_phone          VARCHAR(30),
        insurance_carrier     VARCHAR(200),
        insurance_policy_number VARCHAR(100),
        notes                 TEXT,
        updated_at            TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `;
    console.log('[migration] student_medical_info table ready');
  } catch (err) {
    console.error('[migration] ensureMedicalInfoTable error:', err.message);
  }
}

// 4. Seed demo users if they don't exist (safe to run every boot — upsert by email)
async function seedDemoUsers() {
  const ADMIN_PW = process.env.ADMIN_PASSWORD || 'Admin@Elevate2025!';
  const DEMO_PW  = 'Welcome2025!';
  const demos = [
    { email: 'admin@elevateperformance-academy.com', role: 'admin',              firstName: 'Admin',   lastName: 'EPA',       password: ADMIN_PW },
    { email: 'sarah.johnson@example.com',            role: 'parent',             firstName: 'Sarah',   lastName: 'Johnson',   password: DEMO_PW },
    { email: 'ethan.johnson@example.com',            role: 'student',            firstName: 'Ethan',   lastName: 'Johnson',   password: DEMO_PW },
    { email: 'coach.martinez@elevateperformance-academy.com', role: 'academic_coach',    firstName: 'Carlos',  lastName: 'Martinez',  password: DEMO_PW },
    { email: 'coach.williams@elevateperformance-academy.com', role: 'performance_coach', firstName: 'Jordan',  lastName: 'Williams',  password: DEMO_PW },
  ];
  try {
    for (const d of demos) {
      const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, d.email));
      if (!existing) {
        const passwordHash = await bcrypt.hash(d.password, 10);
        await db.insert(users).values({ email: d.email, passwordHash, role: d.role, firstName: d.firstName, lastName: d.lastName, status: 'active' });
        console.log(`[seed] Created demo user: ${d.email}`);
      }
    }
  } catch (err) {
    console.error('[seed] seedDemoUsers error:', err.message);
  }
}

async function ensureMessageColumns() {
  try {
    await rawSql`ALTER TABLE messages ADD COLUMN IF NOT EXISTS parent_message_id INTEGER REFERENCES messages(id)`;
    await rawSql`ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP`;
    console.log('[migration] messages threading/soft-delete columns ready');
  } catch (err) {
    console.error('[migration] ensureMessageColumns error:', err.message);
  }
}

async function ensureEnrollmentBillingCycleColumn() {
  try {
    await rawSql`ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS billing_cycle_override VARCHAR(30)`;
    console.log('[migration] enrollments billing_cycle_override column ready');
  } catch (err) {
    console.error('[migration] ensureEnrollmentBillingCycleColumn error:', err.message);
  }
}

async function ensureInvoiceDiscountColumn() {
  try {
    await rawSql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS discount_percent NUMERIC(5,2)`;
    console.log('[migration] invoices discount_percent column ready');
  } catch (err) {
    console.error('[migration] ensureInvoiceDiscountColumn error:', err.message);
  }
}

async function ensureFamilyInvoicesTable() {
  try {
    await rawSql`
      CREATE TABLE IF NOT EXISTS family_invoices (
        id                  SERIAL PRIMARY KEY,
        billing_account_id  INTEGER NOT NULL REFERENCES billing_accounts(id),
        total_amount        NUMERIC(10,2) NOT NULL DEFAULT 0,
        status              VARCHAR(20) NOT NULL DEFAULT 'pending',
        due_date            DATE,
        paid_date           DATE,
        stripe_session_id   VARCHAR(255),
        stripe_payment_id   VARCHAR(255),
        notes               TEXT,
        created_at          TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `;
    await rawSql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS family_invoice_id INTEGER REFERENCES family_invoices(id)`;
    await rawSql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS stripe_session_id VARCHAR(255)`;
    console.log('[migration] family_invoices table and invoice columns ready');
  } catch (err) {
    console.error('[migration] ensureFamilyInvoicesTable error:', err.message);
  }
}

async function ensureInvoiceManualOverrideColumn() {
  try {
    await rawSql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS manual_override BOOLEAN NOT NULL DEFAULT FALSE`;
    console.log('[migration] invoices.manual_override column ready');
  } catch (err) {
    console.error('[migration] ensureInvoiceManualOverrideColumn error:', err.message);
  }
}

async function ensureAccountingTables() {
  try {
    await rawSql`
      CREATE TABLE IF NOT EXISTS chart_of_accounts (
        id              SERIAL PRIMARY KEY,
        code            VARCHAR(20) NOT NULL UNIQUE,
        name            VARCHAR(200) NOT NULL,
        type            VARCHAR(20) NOT NULL,
        normal_balance  VARCHAR(10) NOT NULL,
        is_system       BOOLEAN NOT NULL DEFAULT TRUE,
        created_at      TIMESTAMP NOT NULL DEFAULT NOW()
      )`;
    await rawSql`
      CREATE TABLE IF NOT EXISTS journal_entries (
        id                  SERIAL PRIMARY KEY,
        date                DATE NOT NULL,
        description         VARCHAR(500) NOT NULL,
        reference_type      VARCHAR(30),
        reference_id        INTEGER,
        idempotency_key     VARCHAR(100) UNIQUE,
        billing_account_id  INTEGER REFERENCES billing_accounts(id),
        enrollment_id       INTEGER REFERENCES enrollments(id),
        status              VARCHAR(20) NOT NULL DEFAULT 'posted',
        created_by          INTEGER REFERENCES users(id),
        created_at          TIMESTAMP NOT NULL DEFAULT NOW()
      )`;
    await rawSql`
      CREATE TABLE IF NOT EXISTS journal_entry_lines (
        id                SERIAL PRIMARY KEY,
        journal_entry_id  INTEGER NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
        account_id        INTEGER NOT NULL REFERENCES chart_of_accounts(id),
        debit             NUMERIC(10,2) NOT NULL DEFAULT 0,
        credit            NUMERIC(10,2) NOT NULL DEFAULT 0,
        description       VARCHAR(300),
        created_at        TIMESTAMP NOT NULL DEFAULT NOW()
      )`;
    await rawSql`
      CREATE TABLE IF NOT EXISTS payment_allocations (
        id          SERIAL PRIMARY KEY,
        payment_id  INTEGER NOT NULL REFERENCES payments(id),
        invoice_id  INTEGER NOT NULL REFERENCES invoices(id),
        amount      NUMERIC(10,2) NOT NULL,
        created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE (payment_id, invoice_id)
      )`;
    // Indexes for query performance
    await rawSql`CREATE INDEX IF NOT EXISTS idx_je_billing_account ON journal_entries(billing_account_id)`;
    await rawSql`CREATE INDEX IF NOT EXISTS idx_je_date ON journal_entries(date)`;
    await rawSql`CREATE INDEX IF NOT EXISTS idx_je_ref ON journal_entries(reference_type, reference_id)`;
    await rawSql`CREATE INDEX IF NOT EXISTS idx_jel_entry ON journal_entry_lines(journal_entry_id)`;
    await rawSql`CREATE INDEX IF NOT EXISTS idx_jel_account ON journal_entry_lines(account_id)`;
    await rawSql`CREATE INDEX IF NOT EXISTS idx_pa_payment ON payment_allocations(payment_id)`;
    await rawSql`CREATE INDEX IF NOT EXISTS idx_pa_invoice ON payment_allocations(invoice_id)`;
    console.log('[migration] Accounting tables ready');
  } catch (err) {
    console.error('[migration] ensureAccountingTables error:', err.message);
  }
}

async function seedChartOfAccounts() {
  try {
    const accounts = [
      { code: '1000', name: 'Cash',                  type: 'asset',     normalBalance: 'debit'  },
      { code: '1050', name: 'Stripe Clearing',        type: 'asset',     normalBalance: 'debit'  },
      { code: '1100', name: 'Accounts Receivable',    type: 'asset',     normalBalance: 'debit'  },
      { code: '2000', name: 'Deferred Revenue',       type: 'liability', normalBalance: 'credit' },
      { code: '4000', name: 'Tuition Revenue',        type: 'revenue',   normalBalance: 'credit' },
      { code: '4900', name: 'Scholarship Allowance',  type: 'revenue',   normalBalance: 'debit'  },
    ];
    for (const acct of accounts) {
      await rawSql`
        INSERT INTO chart_of_accounts (code, name, type, normal_balance, is_system)
        VALUES (${acct.code}, ${acct.name}, ${acct.type}, ${acct.normalBalance}, TRUE)
        ON CONFLICT (code) DO NOTHING`;
    }
    console.log('[seed] Chart of accounts ready');
  } catch (err) {
    console.error('[seed] seedChartOfAccounts error:', err.message);
  }
}

async function backfillHistoricalLedger() {
  try {
    const { recordInvoiceCreated, recordPaymentReceived, allocatePayment } = await import('./services/accounting.service.js');

    // Backfill paid invoices that predate the ledger (no journal entry yet)
    const paidInvoices = await rawSql`
      SELECT i.id, i.amount, i.description, i.billing_account_id, i.enrollment_id, i.created_at
      FROM invoices i
      WHERE i.status IN ('paid', 'pending', 'past_due')
        AND NOT EXISTS (
          SELECT 1 FROM journal_entries je
          WHERE je.reference_type = 'invoice' AND je.reference_id = i.id
        )`;
    for (const inv of paidInvoices) {
      await recordInvoiceCreated(
        { id: inv.id, amount: inv.amount, description: inv.description, createdAt: inv.created_at },
        inv.enrollment_id,
        inv.billing_account_id,
      ).catch(() => {}); // skip if conflict
    }

    // Backfill payments
    const oldPayments = await rawSql`
      SELECT p.id, p.amount, p.method, p.billing_account_id, p.invoice_id,
             p.stripe_payment_intent_id, p.processed_at
      FROM payments p
      WHERE p.status = 'paid'
        AND NOT EXISTS (
          SELECT 1 FROM journal_entries je
          WHERE je.reference_type = 'payment' AND je.reference_id = p.id
        )`;
    for (const pmt of oldPayments) {
      await recordPaymentReceived({
        id: pmt.id, amount: pmt.amount, method: pmt.method,
        billingAccountId: pmt.billing_account_id, invoiceId: pmt.invoice_id,
        stripePaymentIntentId: pmt.stripe_payment_intent_id, processedAt: pmt.processed_at,
      }).catch(() => {});
      await allocatePayment(pmt.id).catch(() => {});
    }

    if (paidInvoices.length > 0 || oldPayments.length > 0) {
      console.log(`[migration] Backfilled ${paidInvoices.length} invoice(s) and ${oldPayments.length} payment(s) into ledger`);
    }
  } catch (err) {
    console.error('[migration] backfillHistoricalLedger error:', err.message);
  }
}

async function seedProgramTuitions() {
  try {
    // ── Hybrid Microschool ────────────────────────────────────────────────────
    // Step 1: rename any legacy variant (e.g. "Microschool (In-Person Hybrid)", "Microschool")
    // to the canonical name, but only when the canonical name doesn't already exist.
    await rawSql`
      UPDATE programs
        SET name = 'Hybrid Microschool', status = 'active'
      WHERE (name ILIKE '%microschool%' OR name ILIKE '%hybrid%')
        AND name NOT ILIKE '%virtual%'
        AND name <> 'Hybrid Microschool'
        AND NOT EXISTS (SELECT 1 FROM programs WHERE name = 'Hybrid Microschool')`;
    // Step 2: create if still missing
    await rawSql`
      INSERT INTO programs (name, type, description, tuition_amount, billing_cycle, status)
      SELECT 'Hybrid Microschool', 'academic',
             'Personalized academic instruction in a small-group, in-person hybrid setting.',
             750, 'monthly', 'active'
      WHERE NOT EXISTS (
        SELECT 1 FROM programs WHERE name ILIKE '%microschool%' OR name ILIKE '%hybrid%'
      )`;
    // Step 3: ensure correct tuition + metadata on whichever row now holds this program
    await rawSql`
      UPDATE programs
        SET name           = 'Hybrid Microschool',
            tuition_amount = 750,
            billing_cycle  = 'monthly',
            status         = 'active',
            metadata       = jsonb_set(COALESCE(metadata, '{}'), '{prices}', '{"monthly":750,"one_time":7500}')
      WHERE name ILIKE '%microschool%' OR name ILIKE '%hybrid%'`;

    // ── Virtual School 1-day ──────────────────────────────────────────────────
    // Rename "Virtual Homeschool Support" → "Virtual School 1-day" when VS1d doesn't exist yet
    await rawSql`
      UPDATE programs SET name = 'Virtual School 1-day', tuition_amount = 199, billing_cycle = 'monthly', status = 'active'
      WHERE (name ILIKE '%homeschool support%' OR name ILIKE '%virtual home%')
        AND NOT EXISTS (
          SELECT 1 FROM programs WHERE name ILIKE '%virtual school 1%' OR name ILIKE '%1-day%'
        )`;
    // Reassign enrollments pointing at any remaining VHS rows, then delete them
    await rawSql`
      UPDATE enrollments
        SET program_id = (SELECT id FROM programs WHERE name ILIKE '%virtual school 1%' OR name ILIKE '%1-day%' LIMIT 1)
      WHERE program_id IN (
        SELECT id FROM programs WHERE name ILIKE '%homeschool support%' OR name ILIKE '%virtual home%'
      )`;
    await rawSql`DELETE FROM programs WHERE name ILIKE '%homeschool support%' OR name ILIKE '%virtual home%'`;
    // Create VS1d if it still doesn't exist; then lock in correct tuition
    await rawSql`
      INSERT INTO programs (name, type, description, tuition_amount, billing_cycle, status)
      SELECT 'Virtual School 1-day', 'academic', 'Virtual instruction program — 1 day per week.', 199, 'monthly', 'active'
      WHERE NOT EXISTS (
        SELECT 1 FROM programs WHERE name ILIKE '%virtual school 1%' OR name ILIKE '%1-day%'
      )`;
    await rawSql`UPDATE programs SET tuition_amount = 199, billing_cycle = 'monthly', status = 'active'
      WHERE name ILIKE '%virtual school 1%' OR name ILIKE '%1-day%'`;

    // ── Virtual School 2-days ─────────────────────────────────────────────────
    await rawSql`
      INSERT INTO programs (name, type, description, tuition_amount, billing_cycle, status)
      SELECT 'Virtual School 2-days', 'academic', 'Virtual instruction program — 2 days per week.', 299, 'monthly', 'active'
      WHERE NOT EXISTS (
        SELECT 1 FROM programs WHERE name ILIKE '%virtual school 2%' OR name ILIKE '%2-day%' OR name ILIKE '%2 day%'
      )`;
    await rawSql`UPDATE programs SET tuition_amount = 299, billing_cycle = 'monthly', status = 'active'
      WHERE name ILIKE '%virtual school 2%' OR name ILIKE '%2-day%' OR name ILIKE '%2 day%'`;

    // ── Performance Training ──────────────────────────────────────────────────
    // Rename legacy "Elite Athletic Training" if it exists and "Performance Training" doesn't
    await rawSql`
      UPDATE programs SET name = 'Performance Training', tuition_amount = 500, billing_cycle = 'monthly', status = 'active'
      WHERE name ILIKE '%elite athletic%'
        AND NOT EXISTS (SELECT 1 FROM programs WHERE name ILIKE '%performance training%')`;
    // Rename "Athletic Performance Training" (old frontend label) if canonical name doesn't exist
    await rawSql`
      UPDATE programs SET name = 'Performance Training', tuition_amount = 500, billing_cycle = 'monthly', status = 'active'
      WHERE name ILIKE '%athletic performance%'
        AND NOT EXISTS (SELECT 1 FROM programs WHERE name ILIKE '%performance training%')`;
    // Create if still missing
    await rawSql`
      INSERT INTO programs (name, type, description, tuition_amount, billing_cycle, status)
      SELECT 'Performance Training', 'athletic', 'Athletic performance training and development program.', 500, 'monthly', 'active'
      WHERE NOT EXISTS (SELECT 1 FROM programs WHERE name ILIKE '%performance training%')`;
    // Lock in correct tuition
    await rawSql`UPDATE programs SET tuition_amount = 500, billing_cycle = 'monthly', status = 'active'
      WHERE name ILIKE '%performance training%'`;

    // ── Deactivate legacy / combination programs ──────────────────────────────
    await rawSql`UPDATE programs SET status = 'inactive' WHERE name ILIKE '%combination%'`;

    console.log('[seed] Program tuitions and names updated');
  } catch (err) {
    console.error('[seed] seedProgramTuitions error:', err.message);
  }
}

async function ensureLessonStandardsColumn() {
  try {
    await rawSql`ALTER TABLE lesson_assignments ADD COLUMN IF NOT EXISTS standards_codes TEXT`;
    console.log('[migration] lesson_assignments.standards_codes column ready');
  } catch (err) {
    console.error('[migration] ensureLessonStandardsColumn error:', err.message);
  }
}

async function ensureScheduleColumns() {
  try {
    // Phase 1 columns (idempotent)
    await rawSql`ALTER TABLE sections ADD COLUMN IF NOT EXISTS subject VARCHAR(100)`;
    await rawSql`ALTER TABLE sections ADD COLUMN IF NOT EXISTS grade_level VARCHAR(20)`;
    await rawSql`ALTER TABLE sections ADD COLUMN IF NOT EXISTS description TEXT`;
    await rawSql`ALTER TABLE sections ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT FALSE`;
    await rawSql`ALTER TABLE section_students ADD COLUMN IF NOT EXISTS enrollment_id INTEGER REFERENCES enrollments(id)`;
    await rawSql`ALTER TABLE assignment_submissions ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'assigned'`;

    // Phase 2 columns
    await rawSql`ALTER TABLE terms ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'draft'`;
    await rawSql`ALTER TABLE sections ADD COLUMN IF NOT EXISTS coach_user_id INTEGER REFERENCES users(id)`;

    await rawSql`
      CREATE TABLE IF NOT EXISTS class_sessions (
        id               SERIAL PRIMARY KEY,
        section_id       INTEGER NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
        session_date     DATE NOT NULL,
        start_at         VARCHAR(10),
        end_at           VARCHAR(10),
        location_snapshot VARCHAR(200),
        status           VARCHAR(20) NOT NULL DEFAULT 'scheduled',
        canceled_reason  TEXT,
        created_at       TIMESTAMP NOT NULL DEFAULT NOW()
      )`;
    await rawSql`CREATE INDEX IF NOT EXISTS idx_class_sessions_section ON class_sessions(section_id)`;
    await rawSql`CREATE INDEX IF NOT EXISTS idx_class_sessions_date   ON class_sessions(session_date)`;

    await rawSql`ALTER TABLE section_students ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active'`;
    await rawSql`ALTER TABLE section_students ADD COLUMN IF NOT EXISTS placed_at TIMESTAMP DEFAULT NOW()`;
    await rawSql`ALTER TABLE section_students ADD COLUMN IF NOT EXISTS removed_at TIMESTAMP`;
    await rawSql`ALTER TABLE section_students ADD COLUMN IF NOT EXISTS removed_reason TEXT`;

    await rawSql`ALTER TABLE assignment_submissions ADD COLUMN IF NOT EXISTS section_id INTEGER REFERENCES sections(id)`;
    await rawSql`ALTER TABLE assignment_submissions ADD COLUMN IF NOT EXISTS response TEXT`;
    await rawSql`ALTER TABLE assignment_submissions ADD COLUMN IF NOT EXISTS teacher_feedback TEXT`;
    await rawSql`ALTER TABLE assignment_submissions ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP`;

    console.log('[migration] Schedule/classes columns ready (Phase 2)');
  } catch (err) {
    console.error('[migration] ensureScheduleColumns error:', err.message);
  }
}

async function ensureSavedLessonPlansTable() {
  try {
    await rawSql`
      CREATE TABLE IF NOT EXISTS saved_lesson_plans (
        id            SERIAL PRIMARY KEY,
        coach_user_id INTEGER NOT NULL REFERENCES users(id),
        title         VARCHAR(255) NOT NULL,
        subject       VARCHAR(100) NOT NULL DEFAULT 'General',
        grade         VARCHAR(20)  NOT NULL DEFAULT '',
        standard_code VARCHAR(100),
        standard_text TEXT,
        plan_data     TEXT NOT NULL,
        created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMP NOT NULL DEFAULT NOW()
      )`;
    await rawSql`CREATE INDEX IF NOT EXISTS idx_slp_coach ON saved_lesson_plans(coach_user_id)`;
    await rawSql`CREATE INDEX IF NOT EXISTS idx_slp_subject ON saved_lesson_plans(subject)`;
    await rawSql`CREATE INDEX IF NOT EXISTS idx_slp_grade ON saved_lesson_plans(grade)`;
  } catch (err) {
    console.error('[migration] ensureSavedLessonPlansTable error:', err.message);
  }
}

async function syncPendingInvoicesToProgramTuitions() {
  try {
    // Fetch all pending invoices joined to their enrollment + program
    const rows = await db.select({
      invoiceId: invoices.id,
      invoiceAmount: invoices.amount,
      manualOverride: invoices.manualOverride,
      billingCycleOverride: enrollments.billingCycleOverride,
      programTuition: programs.tuitionAmount,
      programBillingCycle: programs.billingCycle,
      programMetadata: programs.metadata,
      activeOverrideId: enrollmentOverrides.id,
    }).from(invoices)
      .leftJoin(enrollments, eq(invoices.enrollmentId, enrollments.id))
      .leftJoin(programs, eq(enrollments.programId, programs.id))
      .leftJoin(enrollmentOverrides, and(
        eq(enrollmentOverrides.enrollmentId, enrollments.id),
        eq(enrollmentOverrides.isActive, true)
      ))
      .where(eq(invoices.status, 'pending'));

    let updated = 0;
    for (const row of rows) {
      if (row.activeOverrideId) continue; // skip — active scholarship/override in effect
      if (row.manualOverride) continue;   // skip — admin manually set this amount
      if (!row.programTuition) continue;
      const cycle = row.billingCycleOverride || row.programBillingCycle || 'monthly';
      const prices = row.programMetadata?.prices;
      const targetAmount = (prices && prices[cycle] != null) ? Number(prices[cycle]) : Number(row.programTuition);
      const currentAmount = parseFloat(row.invoiceAmount);
      if (targetAmount > 0 && Math.abs(targetAmount - currentAmount) > 0.01) {
        await db.update(invoices).set({ amount: String(targetAmount) }).where(eq(invoices.id, row.invoiceId));
        updated++;
      }
    }
    if (updated > 0) console.log(`[migration] Synced ${updated} pending invoice(s) to current program tuitions`);
  } catch (err) {
    console.error('[migration] syncPendingInvoicesToProgramTuitions error:', err.message);
  }
}

if (!process.env.STRIPE_WEBHOOK_SECRET) {
  console.warn('[startup] WARNING: STRIPE_WEBHOOK_SECRET is not set. Stripe webhook signature verification is disabled. Set this env var before going to production.');
}

normalizeEnrollmentStatuses();
revertPartialOverrideEnrollments();
fixAdminCreatedInvoiceBillingAccounts();
ensureOverridesTable();
ensureSubmissionContentColumn();
ensureMedicalInfoTable();
ensureMessageColumns();
ensureEnrollmentBillingCycleColumn();
ensureInvoiceDiscountColumn();
ensureFamilyInvoicesTable();
ensureInvoiceManualOverrideColumn();
ensureAccountingTables();
ensureScheduleColumns();
ensureLessonStandardsColumn();
ensureSavedLessonPlansTable();
seedProgramTuitions().then(() => syncPendingInvoicesToProgramTuitions());
seedChartOfAccounts();
backfillHistoricalLedger();
seedDemoUsers();
import applicationsRouter from './routes/applications.js';
import authRouter from './routes/auth.js';
import contactRouter from './routes/contact.js';
import usersRouter from './routes/users.js';
import studentsRouter from './routes/students.js';
import schoolYearsRouter from './routes/school-years.js';
import programsRouter from './routes/programs.js';
import sectionsRouter from './routes/sections.js';
import enrollmentsRouter from './routes/enrollments.js';
import billingRouter from './routes/billing.js';
import staffAssignmentsRouter from './routes/staff-assignments.js';
import assignmentsRouter from './routes/assignments.js';
import attendanceRouter from './routes/attendance.js';
import trainingLogsRouter from './routes/training-logs.js';
import coachNotesRouter from './routes/coach-notes.js';
import progressRouter from './routes/progress.js';
import messagesRouter from './routes/messages.js';
import announcementsRouter from './routes/announcements.js';
import notificationsRouter from './routes/notifications.js';
import resourcesRouter from './routes/resources.js';
import documentsRouter from './routes/documents.js';
import rewardsRouter from './routes/rewards.js';
import cmsRouter from './routes/cms.js';
import gradebookRouter from './routes/gradebook.js';
import auditLogsRouter from './routes/audit-logs.js';
import stripeRouter, { stripeWebhookHandler } from './routes/stripe.js';
import familyBillingRouter from './routes/familyBilling.js';
import coachAssignmentsRouter from './routes/coach-assignments.js';
import coachesRouter from './routes/coaches.js';
import eventsRouter from './routes/events.js';
import accountingRouter from './routes/accounting.js';
import lessonAIRouter from './routes/lessonAI.js';
import savedLessonsRouter from './routes/savedLessons.js';
import cron from 'node-cron';

const isDev = process.env.NODE_ENV !== 'production';

const app = express();

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', mode: isDev ? 'development' : 'production' });
});

// Env check — verify required env vars are set (no token needed, non-sensitive)
app.get('/api/admin/env-check', (req, res) => {
  const vars = ['DATABASE_URL', 'ADMIN_TOKEN', 'ADMIN_PASSWORD', 'JWT_SECRET'];
  const status = {};
  for (const v of vars) status[v] = process.env[v] ? 'SET' : 'MISSING';
  const allSet = Object.values(status).every(s => s === 'SET');
  res.status(allSet ? 200 : 500).json({ allSet, vars: status });
});

// Admin init — seeds admin user on demand (protected by ADMIN_TOKEN)
// Call once after deployment: GET /api/admin/init?token=YOUR_ADMIN_TOKEN
app.get('/api/admin/init', async (req, res) => {
  const token = req.query.token || req.headers['x-admin-token'];
  if (!token || token !== process.env.ADMIN_TOKEN) {
    return res.status(403).json({ success: false, error: 'Forbidden — wrong or missing token' });
  }
  if (!process.env.DATABASE_URL) {
    return res.status(500).json({ success: false, error: 'DATABASE_URL is not set in environment variables' });
  }
  if (!process.env.ADMIN_PASSWORD) {
    return res.status(500).json({ success: false, error: 'ADMIN_PASSWORD is not set in environment variables' });
  }
  try {
    const adminEmail = 'admin@elevateperformance-academy.com';
    const [existing] = await db.select().from(users).where(eq(users.email, adminEmail));
    if (existing && existing.passwordHash) {
      return res.json({ success: true, message: 'Admin already exists with password set.', email: adminEmail, action: 'none' });
    }
    const passwordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);
    if (existing) {
      await db.update(users).set({ passwordHash, status: 'active' }).where(eq(users.email, adminEmail));
      return res.json({ success: true, message: 'Admin password set.', email: adminEmail, action: 'updated' });
    }
    await db.insert(users).values({
      email: adminEmail,
      passwordHash,
      role: 'admin',
      firstName: 'Admin',
      lastName: 'EPA',
      status: 'active',
    });
    return res.json({ success: true, message: 'Admin user created.', email: adminEmail, action: 'created' });
  } catch (err) {
    console.error('[admin/init] error:', err.message);
    return res.status(500).json({ success: false, error: err.message, hint: 'Check that DATABASE_URL is correct and the database is reachable.' });
  }
});

app.use(helmet({ contentSecurityPolicy: false }));

// CORS — same-origin on Vercel (frontend + API on same domain), allow localhost in dev
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : [];

app.use(cors({
  origin: (origin, callback) => {
    // Allow same-origin requests (origin is undefined for same-origin + server-side)
    if (!origin) return callback(null, true);
    // Allow localhost in dev
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) return callback(null, true);
    // Allow explicitly configured origins
    if (allowedOrigins.length && allowedOrigins.includes(origin)) return callback(null, true);
    // Allow the Vercel deployment domain
    if (origin.includes('vercel.app') || origin.includes('replit.app') || origin.includes('replit.dev')) return callback(null, true);
    // In production without explicit origins configured, allow all (API is protected by auth)
    callback(null, true);
  },
  credentials: true,
}));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 20,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register-invite', authLimiter);

const publicFormLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, max: 10,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many submissions. Please try again in an hour.' },
});
app.use('/api/applications', publicFormLimiter);
app.use('/api/contact', publicFormLimiter);

app.use(express.json());

app.use('/api/applications', applicationsRouter);
app.use('/api/auth', authRouter);
app.use('/api/contact', contactRouter);
app.use('/api/users', usersRouter);
app.use('/api/students', studentsRouter);
app.use('/api/school-years', schoolYearsRouter);
app.use('/api/programs', programsRouter);
app.use('/api/sections', sectionsRouter);
app.use('/api/enrollments', enrollmentsRouter);
app.use('/api/billing', billingRouter);
app.use('/api/billing', familyBillingRouter);
app.use('/api/staff-assignments', staffAssignmentsRouter);
app.use('/api/assignments', assignmentsRouter);
app.use('/api/attendance', attendanceRouter);
app.use('/api/training-logs', trainingLogsRouter);
app.use('/api/coach-notes', coachNotesRouter);
app.use('/api/progress', progressRouter);
app.use('/api/messages', messagesRouter);
app.use('/api/announcements', announcementsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/resources', resourcesRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/rewards', rewardsRouter);
app.use('/api/cms', cmsRouter);
app.use('/api/gradebook', gradebookRouter);
app.use('/api/audit-logs', auditLogsRouter);
app.use('/api/coach-assignments', coachAssignmentsRouter);
app.use('/api/coaches', coachesRouter);
app.use('/api/events', eventsRouter);
app.use('/api/accounting', accountingRouter);
app.use('/api/lesson-ai', lessonAIRouter);
app.use('/api/saved-lessons', savedLessonsRouter);
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), stripeWebhookHandler);
app.use('/api/stripe', stripeRouter);

// Admin-triggered demo data seed (requires admin JWT)
app.post('/api/admin/seed-demo-data', requireAdmin, async (req, res) => {
  try {
    const report = [];

    const [academicCoachUser] = await db.select().from(users).where(eq(users.email, 'coach.martinez@elevateperformance-academy.com'));
    const [perfCoachUser] = await db.select().from(users).where(eq(users.email, 'coach.williams@elevateperformance-academy.com'));
    const [studentUser] = await db.select().from(users).where(eq(users.email, 'ethan.johnson@example.com'));
    const [parentUser] = await db.select().from(users).where(eq(users.email, 'sarah.johnson@example.com'));

    if (!academicCoachUser || !perfCoachUser || !studentUser) {
      return res.status(400).json({ success: false, error: 'Demo users not found. Ensure demo users exist first.' });
    }

    let [student] = await db.select().from(students).where(eq(students.userId, studentUser.id));
    if (!student) {
      [student] = await db.insert(students).values({
        userId: studentUser.id, firstName: 'Ethan', lastName: 'Johnson',
        grade: '10th', dateOfBirth: '2010-03-15', status: 'active',
      }).returning();
      report.push('Created student record: Ethan Johnson');
    }

    if (parentUser) {
      const [existingLink] = await db.select().from(guardianStudents)
        .where(and(eq(guardianStudents.guardianUserId, parentUser.id), eq(guardianStudents.studentId, student.id)));
      if (!existingLink) {
        await db.insert(guardianStudents).values({ guardianUserId: parentUser.id, studentId: student.id, relationship: 'parent', isPrimary: true });
        report.push('Created guardian-student link');
      }
    }

    const existingCA = await db.select().from(coachAssignments).where(eq(coachAssignments.studentId, student.id));
    if (!existingCA.length) {
      await db.insert(coachAssignments).values([
        { coachUserId: academicCoachUser.id, coachType: 'academic_coach', studentId: student.id, isActive: true, startDate: '2025-08-15' },
        { coachUserId: perfCoachUser.id, coachType: 'performance_coach', studentId: student.id, isActive: true, startDate: '2025-08-15' },
      ]);
      report.push('Created coach assignments (academic + performance)');
    }

    const existingLessons = await db.select().from(lessonAssignments).where(eq(lessonAssignments.studentId, student.id));
    if (!existingLessons.length) {
      const now = new Date();
      const ago = (n) => new Date(now.getTime() - n * 86400000);
      const ahead = (n) => new Date(now.getTime() + n * 86400000);
      await db.insert(lessonAssignments).values([
        { studentId: student.id, academicCoachUserId: academicCoachUser.id, subject: 'Math', title: 'Linear Equations Practice', instructions: 'Complete problems 1–20 from Chapter 3.', dueAt: ago(5), status: 'complete', completedAt: ago(6), pointsPossible: 20, pointsEarned: 18 },
        { studentId: student.id, academicCoachUserId: academicCoachUser.id, subject: 'Science', title: 'Chemical Reactions Lab Write-Up', instructions: 'Write a formal lab report following the template provided.', dueAt: ago(2), status: 'complete', completedAt: ago(3), pointsPossible: 30, pointsEarned: 26 },
        { studentId: student.id, academicCoachUserId: academicCoachUser.id, subject: 'English', title: 'Persuasive Essay Draft', instructions: 'Write a 3–5 paragraph persuasive essay.', dueAt: ahead(3), status: 'incomplete', pointsPossible: 25 },
        { studentId: student.id, academicCoachUserId: academicCoachUser.id, subject: 'History', title: 'WWII Timeline Research', instructions: 'Create a detailed timeline of major WWII events from 1939–1945.', dueAt: ahead(7), status: 'incomplete', pointsPossible: 15 },
        { studentId: student.id, academicCoachUserId: academicCoachUser.id, subject: 'Math', title: 'Quadratic Equations Quiz Prep', instructions: 'Review chapters 4–5.', dueAt: ago(15), status: 'incomplete', pointsPossible: 20 },
      ]);
      report.push('Created 5 lesson assignments');
    }

    const existingCatalog = await db.select().from(rewardCatalog);
    if (!existingCatalog.length) {
      await db.insert(rewardCatalog).values([
        { name: 'Free Homework Pass', description: 'Skip one homework assignment of your choice.', pointCost: 100, isActive: true },
        { name: 'Extra Credit Opportunity', description: 'Unlock a special extra credit project.', pointCost: 150, isActive: true },
        { name: 'Choose Your Study Music', description: 'Play music during one solo study session.', pointCost: 50, isActive: true },
        { name: 'Lunch with Your Coach', description: 'One-on-one lunch session with your academic coach.', pointCost: 200, isActive: true },
        { name: 'Early Dismissal (30 min)', description: 'Leave 30 minutes early on a school day.', pointCost: 300, isActive: true },
      ]);
      report.push('Created 5 reward catalog items');
    }

    const [existingPoints] = await db.select().from(studentPoints).where(eq(studentPoints.studentId, student.id));
    if (!existingPoints) {
      await db.insert(studentPoints).values({ studentId: student.id, points: 185 });
      await db.insert(pointTransactions).values([
        { studentId: student.id, delta: 50, reason: 'Completed Linear Equations Practice on time', awardedBy: academicCoachUser.id },
        { studentId: student.id, delta: 75, reason: 'Excellent lab write-up — above and beyond', awardedBy: academicCoachUser.id },
        { studentId: student.id, delta: 25, reason: 'Great effort in training session', awardedBy: perfCoachUser.id },
        { studentId: student.id, delta: 50, reason: 'Perfect attendance this week', awardedBy: null },
        { studentId: student.id, delta: -15, reason: 'Redeemed: Choose Your Study Music' },
      ]);
      report.push('Created student points (185) with 5 transactions');
    }

    // Emergency contacts for Ethan
    const existingContacts = await db.select().from(emergencyContacts).where(eq(emergencyContacts.studentId, student.id));
    if (!existingContacts.length) {
      await db.insert(emergencyContacts).values([
        { studentId: student.id, name: 'Sarah Johnson', relationship: 'Mother', phone: '(555) 123-4567', isAuthorizedPickup: true, priorityOrder: 1 },
        { studentId: student.id, name: 'David Johnson', relationship: 'Father', phone: '(555) 987-6543', isAuthorizedPickup: true, priorityOrder: 2 },
      ]);
      report.push('Created emergency contacts for Ethan');
    }

    // CMS content
    const existingCms = await db.select().from(cmsContent);
    if (!existingCms.length) {
      await db.insert(cmsContent).values([
        { key: 'home', title: 'Elevate Education Hub', body: 'Transforming student potential through personalized academic and athletic excellence.', section: 'pages' },
        { key: 'faq-1', title: 'What programs do you offer?', body: 'We offer Academic, Homeschool Support, Athletic Performance, Recruitment & College Prep, and Family Resource Center programs.', section: 'faq' },
        { key: 'faq-2', title: 'How do I enroll my child?', body: 'Submit an admissions application on our website. Once approved, you will receive an invitation to create your parent account and complete enrollment.', section: 'faq' },
        { key: 'faq-3', title: 'What are the tuition payment options?', body: 'We offer monthly and annual billing cycles. Annual plans include a discount. Payments are processed securely through Stripe.', section: 'faq' },
        { key: 'cancellation-policy', title: 'Cancellation Policy', body: 'Cancellations must be submitted 30 days in advance. Monthly subscribers may cancel at any time effective at the next billing cycle. Annual plans are non-refundable after the first 14 days.', section: 'pages' },
      ]);
      report.push('Created CMS content (home, 3 FAQs, cancellation policy)');
    }

    res.json({ success: true, seeded: report.length > 0 ? report : ['All demo data already exists'] });
  } catch (err) {
    console.error('[admin/seed-demo-data] error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Revenue recognition cron — runs on the 1st of every month at 2:00 AM
// Skipped on Vercel (no persistent process; trigger manually via POST /api/accounting/recognize-revenue)
if (!process.env.VERCEL) cron.schedule('0 2 1 * *', async () => {
  try {
    const { recognizeRevenue } = await import('./services/accounting.service.js');
    const d = new Date(); d.setMonth(d.getMonth() - 1);
    const period = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const result = await recognizeRevenue(period);
    console.log(`[cron] Revenue recognition ${period}: ${result.recognized} entries created, ${result.skipped} skipped`);
  } catch (err) {
    console.error('[cron] Revenue recognition error:', err.message);
  }
});

export default app;
