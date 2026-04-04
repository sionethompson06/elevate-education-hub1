import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './server/schema.js';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

const { programs, sections, schoolYears, terms } = schema;

console.log('Seeding programs, school year, terms, and sections...\n');

// ── School Year ───────────────────────────────────────────────────────────────
const [sy] = await db.insert(schoolYears).values({
  name: '2025-2026',
  startDate: '2025-08-15',
  endDate: '2026-06-15',
  isCurrent: true,
}).onConflictDoNothing().returning();

const schoolYearId = sy?.id;
console.log('✓ School year 2025-2026', schoolYearId ? `(id: ${schoolYearId})` : '(already exists)');

// Get school year id if already existed
let syId = schoolYearId;
if (!syId) {
  const existing = await db.select().from(schoolYears).limit(1);
  syId = existing[0]?.id;
}

// ── Terms ─────────────────────────────────────────────────────────────────────
if (syId) {
  await db.insert(terms).values([
    { schoolYearId: syId, name: 'Fall 2025', startDate: '2025-08-15', endDate: '2025-12-20' },
    { schoolYearId: syId, name: 'Spring 2026', startDate: '2026-01-10', endDate: '2026-06-15' },
  ]).onConflictDoNothing();
  console.log('✓ Terms: Fall 2025, Spring 2026');
}

// ── Programs ──────────────────────────────────────────────────────────────────
const programData = [
  {
    name: 'Hybrid Microschool',
    type: 'academic',
    description: 'Full academic curriculum with small class sizes and personalized instruction. Mon/Tue/Thu on-site, Wed home learning, Fri enrichment. Grades K–12, max 40 students.',
    tuitionAmount: '15000.00',
    billingCycle: 'annual',
    status: 'active',
    schoolYearId: syId,
  },
  {
    name: 'Elite Athletic Training',
    type: 'athletic',
    description: 'Year-round athletic development with sport-specific training and college prep. Speed, strength, injury prevention, nutrition, mental performance, NIL mentorship.',
    tuitionAmount: '8500.00',
    billingCycle: 'semester',
    status: 'active',
    schoolYearId: syId,
  },
  {
    name: 'Homeschool Support',
    type: 'virtual',
    description: 'K–12 virtual support with dedicated academic coach. Synchronous and asynchronous learning, Personal Learning Plans, small cohorts of 6–8 students.',
    tuitionAmount: '199.00',
    billingCycle: 'monthly',
    status: 'active',
    schoolYearId: syId,
  },
  {
    name: 'Homeschool Support — 2x Weekly',
    type: 'virtual',
    description: 'Enhanced K–12 virtual support with 2 sessions per week. Mon/Wed via Zoom, 1–2 hours each. College prep and transcript planning included.',
    tuitionAmount: '399.00',
    billingCycle: 'monthly',
    status: 'active',
    schoolYearId: syId,
  },
];

const insertedPrograms = await db.insert(programs).values(programData).onConflictDoNothing().returning();
console.log(`✓ Programs inserted: ${insertedPrograms.length}`);
insertedPrograms.forEach(p => console.log(`  - ${p.name} ($${p.tuitionAmount}/${p.billingCycle}) id:${p.id}`));

// ── Sections ──────────────────────────────────────────────────────────────────
const hybridId = insertedPrograms.find(p => p.name === 'Hybrid Microschool')?.id;
const athleticId = insertedPrograms.find(p => p.name === 'Elite Athletic Training')?.id;
const homeschool1Id = insertedPrograms.find(p => p.name === 'Homeschool Support')?.id;
const homeschool2Id = insertedPrograms.find(p => p.name === 'Homeschool Support — 2x Weekly')?.id;

const sectionData = [];

if (hybridId) {
  sectionData.push(
    { programId: hybridId, name: 'Grades K–2 (Session 1)', capacity: 10, schedule: { days: ['Monday','Tuesday','Thursday'], time: '9:00-10:30 AM', room: 'Classroom 01' }, schoolYearId: syId },
    { programId: hybridId, name: 'Grades 3–4 (Session 2)', capacity: 10, schedule: { days: ['Monday','Tuesday','Thursday'], time: '11:00 AM-12:30 PM', room: 'Classroom 01' }, schoolYearId: syId },
    { programId: hybridId, name: 'Grades 5–6 (Session 1)', capacity: 10, schedule: { days: ['Monday','Tuesday','Thursday'], time: '9:00-10:30 AM', room: 'Classroom 02' }, schoolYearId: syId },
    { programId: hybridId, name: 'Grades 7–8 (Session 2)', capacity: 10, schedule: { days: ['Monday','Tuesday','Thursday'], time: '11:00 AM-12:30 PM', room: 'Classroom 02' }, schoolYearId: syId },
    { programId: hybridId, name: 'Grades 9–12 (AM)', capacity: 10, schedule: { days: ['Monday','Tuesday','Thursday'], time: '9:00-10:30 AM', room: 'Classroom 03' }, schoolYearId: syId },
    { programId: hybridId, name: 'Grades 9–12 (PM)', capacity: 10, schedule: { days: ['Monday','Tuesday','Thursday'], time: '11:00 AM-12:30 PM', room: 'Classroom 03' }, schoolYearId: syId },
  );
}

if (athleticId) {
  sectionData.push(
    { programId: athleticId, name: 'Strength & Conditioning', capacity: 20, schedule: { days: ['Tuesday','Thursday'], time: '2:00-4:00 PM', room: 'Athletic Center' }, schoolYearId: syId },
    { programId: athleticId, name: 'Speed Development', capacity: 20, schedule: { days: ['Monday','Wednesday'], time: '3:00-4:00 PM', room: 'Athletic Center' }, schoolYearId: syId },
    { programId: athleticId, name: 'College & NIL Prep', capacity: 15, schedule: { days: ['Friday'], time: '10:00-11:30 AM', room: 'Conference Room' }, schoolYearId: syId },
  );
}

if (homeschool1Id) {
  sectionData.push(
    { programId: homeschool1Id, name: 'Cohort A — 1x Weekly', capacity: 8, schedule: { days: ['Monday'], time: '10:00 AM-12:00 PM', room: 'Virtual (Zoom)' }, schoolYearId: syId },
    { programId: homeschool1Id, name: 'Cohort B — 1x Weekly', capacity: 8, schedule: { days: ['Wednesday'], time: '10:00 AM-12:00 PM', room: 'Virtual (Zoom)' }, schoolYearId: syId },
  );
}

if (homeschool2Id) {
  sectionData.push(
    { programId: homeschool2Id, name: 'Cohort A — 2x Weekly', capacity: 8, schedule: { days: ['Monday','Wednesday'], time: '10:00 AM-12:00 PM', room: 'Virtual (Zoom)' }, schoolYearId: syId },
    { programId: homeschool2Id, name: 'Cohort B — 2x Weekly', capacity: 8, schedule: { days: ['Monday','Wednesday'], time: '1:00-3:00 PM', room: 'Virtual (Zoom)' }, schoolYearId: syId },
  );
}

if (sectionData.length) {
  const insertedSections = await db.insert(sections).values(sectionData).onConflictDoNothing().returning();
  console.log(`\n✓ Sections inserted: ${insertedSections.length}`);
  insertedSections.forEach(s => console.log(`  - ${s.name} (capacity: ${s.capacity})`));
}

console.log('\n✅ All done! Programs, school year, terms, and sections are ready.');
await pool.end();
