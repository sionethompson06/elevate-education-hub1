import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import db from './db-postgres.js';
import { users } from './schema.js';
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

// Admin init — seeds admin user on demand (protected by ADMIN_TOKEN)
// Call once after deployment: GET /api/admin/init?token=YOUR_ADMIN_TOKEN
app.get('/api/admin/init', async (req, res) => {
  const token = req.query.token || req.headers['x-admin-token'];
  if (!token || token !== process.env.ADMIN_TOKEN) {
    return res.status(403).json({ success: false, error: 'Forbidden' });
  }
  try {
    const adminEmail = 'admin@elevateperformance-academy.com';
    const [existing] = await db.select().from(users).where(eq(users.email, adminEmail));
    if (existing && existing.passwordHash) {
      return res.json({ success: true, message: 'Admin user already exists and has a password set.' });
    }
    const passwordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);
    if (existing) {
      await db.update(users).set({ passwordHash, status: 'active' }).where(eq(users.email, adminEmail));
      return res.json({ success: true, message: 'Admin password updated.', email: adminEmail });
    }
    await db.insert(users).values({
      email: adminEmail,
      passwordHash,
      role: 'admin',
      firstName: 'Admin',
      lastName: 'EPA',
      status: 'active',
    });
    return res.json({ success: true, message: 'Admin user created.', email: adminEmail });
  } catch (err) {
    console.error('[admin/init] error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: isDev
    ? ['http://localhost:5173', 'http://localhost:3001', 'http://localhost:5000']
    : (process.env.ALLOWED_ORIGINS || '*'),
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
