import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import db from './db-postgres.js';
import { users } from './schema.js';

async function seed() {
  const adminEmail = 'admin@elevateperformance-academy.com';
  const [existing] = await db.select().from(users).where(eq(users.email, adminEmail));
  
  if (existing) {
    console.log('Admin user already exists.');
    process.exit(0);
  }

  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  await db.insert(users).values({
    email: adminEmail,
    passwordHash,
    role: 'admin',
    firstName: 'Admin',
    lastName: 'EPA',
    status: 'active',
  });

  console.log(`Admin user created: ${adminEmail}`);
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
