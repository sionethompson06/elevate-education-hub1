import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import { eq, and } from 'drizzle-orm';
import db, { rawSql } from './db-postgres.js';
import {
  users, enrollments, students, guardianStudents, coachAssignments,
  lessonAssignments, rewardCatalog, studentPoints, pointTransactions,
  emergencyContacts, cmsContent, programs, invoices, enrollmentOverrides,
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

// 2. Create enrollment_overrides table if it doesn't exist
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

async function seedProgramTuitions() {
  try {
    // Hybrid Microschool — update tuition + store per-cycle prices in metadata
    await rawSql`UPDATE programs SET tuition_amount = 750, billing_cycle = 'monthly',
      metadata = jsonb_set(COALESCE(metadata, '{}'), '{prices}', '{"monthly":750,"one_time":7500}')
      WHERE name ILIKE '%hybrid%'`;

    // Virtual School 1-day — merge "Virtual Homeschool Support" if it exists as a duplicate
    // Step 1: rename VHS → VS1d when VS1d doesn't exist yet (preserves enrollment links)
    await rawSql`
      UPDATE programs SET name = 'Virtual School 1-day', tuition_amount = 199, billing_cycle = 'monthly', status = 'active'
      WHERE (name ILIKE '%homeschool support%' OR name ILIKE '%virtual home%')
        AND NOT EXISTS (
          SELECT 1 FROM programs WHERE name ILIKE '%virtual school 1%' OR name ILIKE '%1-day%'
        )`;
    // Step 2: if both VS1d and VHS now exist, reassign VHS enrollments to VS1d then delete VHS
    await rawSql`
      UPDATE enrollments
        SET program_id = (SELECT id FROM programs WHERE name ILIKE '%virtual school 1%' OR name ILIKE '%1-day%' LIMIT 1)
      WHERE program_id IN (
        SELECT id FROM programs WHERE name ILIKE '%homeschool support%' OR name ILIKE '%virtual home%'
      )`;
    await rawSql`DELETE FROM programs WHERE name ILIKE '%homeschool support%' OR name ILIKE '%virtual home%'`;
    // Create VS1d if neither old nor new name exists, then ensure correct tuition
    await rawSql`
      INSERT INTO programs (name, type, description, tuition_amount, billing_cycle, status)
      SELECT 'Virtual School 1-day', 'academic', 'Virtual instruction program — 1 day per week.', 199, 'monthly', 'active'
      WHERE NOT EXISTS (
        SELECT 1 FROM programs WHERE name ILIKE '%virtual school 1%' OR name ILIKE '%1-day%'
      )`;
    await rawSql`UPDATE programs SET tuition_amount = 199, billing_cycle = 'monthly', status = 'active'
      WHERE name ILIKE '%virtual school 1%' OR name ILIKE '%1-day%'`;

    // Virtual School 2-days — create if missing, then ensure correct tuition
    await rawSql`
      INSERT INTO programs (name, type, description, tuition_amount, billing_cycle, status)
      SELECT 'Virtual School 2-days', 'academic', 'Virtual instruction program — 2 days per week.', 299, 'monthly', 'active'
      WHERE NOT EXISTS (
        SELECT 1 FROM programs WHERE name ILIKE '%virtual school 2%' OR name ILIKE '%2-day%' OR name ILIKE '%2 day%'
      )`;
    await rawSql`UPDATE programs SET tuition_amount = 299, billing_cycle = 'monthly', status = 'active'
      WHERE name ILIKE '%virtual school 2%' OR name ILIKE '%2-day%' OR name ILIKE '%2 day%'`;

    // Performance Training — rename "Elite Athletic Training" if it exists and "Performance Training" doesn't
    // (preserves all existing enrollment links since the program ID stays the same)
    await rawSql`
      UPDATE programs SET name = 'Performance Training', tuition_amount = 500, billing_cycle = 'monthly', status = 'active'
      WHERE name ILIKE '%elite athletic%'
        AND NOT EXISTS (SELECT 1 FROM programs WHERE name ILIKE '%performance training%')`;
    // Create Performance Training if neither old nor new name exists
    await rawSql`
      INSERT INTO programs (name, type, description, tuition_amount, billing_cycle, status)
      SELECT 'Performance Training', 'athletic', 'Athletic performance training and development program.', 500, 'monthly', 'active'
      WHERE NOT EXISTS (SELECT 1 FROM programs WHERE name ILIKE '%performance training%')`;
    // Ensure correct tuition in case it already existed
    await rawSql`UPDATE programs SET tuition_amount = 500, billing_cycle = 'monthly', status = 'active'
      WHERE name ILIKE '%performance training%'`;

    console.log('[seed] Program tuitions and names updated');
  } catch (err) {
    console.error('[seed] seedProgramTuitions error:', err.message);
  }
}

async function syncPendingInvoicesToProgramTuitions() {
  try {
    // Fetch all pending invoices joined to their enrollment + program
    const rows = await db.select({
      invoiceId: invoices.id,
      invoiceAmount: invoices.amount,
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

normalizeEnrollmentStatuses();
ensureOverridesTable();
ensureSubmissionContentColumn();
ensureMedicalInfoTable();
ensureMessageColumns();
ensureEnrollmentBillingCycleColumn();
ensureInvoiceDiscountColumn();
seedProgramTuitions().then(() => syncPendingInvoicesToProgramTuitions());
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
import coachAssignmentsRouter from './routes/coach-assignments.js';

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

export default app;
