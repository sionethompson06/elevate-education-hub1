import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

const isDev = process.env.NODE_ENV !== 'production';

const requiredEnv = ['DATABASE_URL', 'ADMIN_TOKEN', 'ADMIN_PASSWORD'];
for (const key of requiredEnv) {
  if (!process.env[key]) {
    console.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

async function ensureAdminUser() {
  try {
    const bcrypt = await import('bcryptjs');
    const { eq } = await import('drizzle-orm');
    const { default: db } = await import('./db-postgres.js');
    const { users } = await import('./schema.js');
    
    const adminEmail = 'admin@elevateperformance-academy.com';
    const [existing] = await db.select().from(users).where(eq(users.email, adminEmail));
    if (existing) {
      console.log('[SEED] Admin user already exists.');
      return;
    }
    const passwordHash = await bcrypt.default.hash(process.env.ADMIN_PASSWORD, 10);
    await db.insert(users).values({
      email: adminEmail,
      passwordHash,
      role: 'admin',
      firstName: 'Admin',
      lastName: 'EPA',
      status: 'active',
    });
    console.log(`[SEED] Admin user created: ${adminEmail}`);
  } catch (err) {
    console.error('[SEED] Failed to seed admin user:', err.message);
  }
}

async function startServer() {
  await ensureAdminUser();

  const app = express();
  // Dev: API on 3001 (Vite dev server on 5173 proxies /api here)
  // Production: everything on PORT (default 5000)
  const PORT = isDev ? (process.env.API_PORT || 3001) : (process.env.PORT || 5000);

  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', mode: isDev ? 'development' : 'production' });
  });

  app.use(cors({ origin: isDev ? 'http://localhost:5173' : true, credentials: true }));
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

  if (!isDev) {
    const distPath = join(ROOT, 'dist');
    const indexPath = join(distPath, 'index.html');
    console.log(`Production mode — serving static files from: ${distPath}`);
    console.log(`index.html exists: ${existsSync(indexPath)}`);

    const { default: serveStatic } = await import('serve-static');
    app.use(serveStatic(distPath, { index: ['index.html'] }));
    app.get('*', (req, res) => {
      if (!existsSync(indexPath)) {
        return res.status(503).send('Application build not found. Run: npm run build');
      }
      res.sendFile(indexPath);
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`API server running on port ${PORT} (${isDev ? 'development' : 'production'})`);
    if (isDev) {
      console.log('Frontend dev server: run "npm run dev:frontend" in a separate terminal');
    }
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
