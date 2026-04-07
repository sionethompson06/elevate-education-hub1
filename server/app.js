import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import { eq, ne } from 'drizzle-orm';
import db from './db-postgres.js';
import { users, enrollments } from './schema.js';

// One-time data migration: normalize legacy 'pending' enrollment status → 'pending_payment'
// Safe to run on every startup — no-op once all records are already normalized.
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
normalizeEnrollmentStatuses();
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

export default app;
