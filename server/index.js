import 'dotenv/config';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import db from './db-postgres.js';
import { users } from './schema.js';
import app from './app.js';

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
    const adminEmail = 'admin@elevateperformance-academy.com';
    const [existing] = await db.select().from(users).where(eq(users.email, adminEmail));
    if (existing && existing.passwordHash) {
      console.log('[SEED] Admin user already exists.');
      return;
    }
    const passwordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);
    if (existing) {
      await db.update(users).set({ passwordHash, status: 'active' }).where(eq(users.email, adminEmail));
      console.log(`[SEED] Admin password updated: ${adminEmail}`);
      return;
    }
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

  const PORT = isDev ? (process.env.API_PORT || 3001) : (process.env.PORT || 5000);

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
    console.log(`Server running on port ${PORT} (${isDev ? 'development' : 'production'})`);
    if (isDev) {
      console.log('Frontend dev server: run "npm run dev:frontend" in a separate terminal');
    }
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
