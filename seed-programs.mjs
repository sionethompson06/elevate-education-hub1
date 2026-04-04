import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './server/schema.js';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

const { programs, sections, schoolYears, terms } = schema;

console.log('Seeding programs, school year, terms, and sections...\n');

// ── Clear existing program data ───────────────────────────────────────────────
await db.delete(sections);
await db.delete(programs);
await db.delete(terms);
await db.delete(schoolYears);
console.log('✓ Cleared old program data');

// ── School Year ───────────────────────────────────────────────────────────────
const [sy] = await db.insert(schoolYears).values({
  name: '2025-2026',
  startDate: '2025-08-15',
  endDate: '2026-06-15',
  isCurrent: true,
}).returning();
console.log(`✓ School year 2025-2026 (id: ${sy.id})`);

// ── Terms ─────────────────────────────────────────────────────────────────────
await db.insert(terms).values([
  { schoolYearId: sy.id, name: 'Fall 2025', startDate: '2025-08-15', endDate: '2025-12-20' },
  { schoolYearId: sy.id, name: 'Spring 2026', startDate: '2026-01-10', endDate: '2026-06-15' },
]);
console.log('✓ Terms: Fall 2025, Spring 2026');

// ── Programs ──────────────────────────────────────────────────────────────────
const programData = [
  {
    name: 'Hybrid Microschool',
    type: 'academic',
    description: 'A K–12 learning environment where every student is known, challenged, and supported. Small cohorts, mastery-based learning, and a schedule designed for maximum academic performance.',
    tuitionAmount: '750.00',
    billingCycle: 'monthly',
    status: 'active',
    schoolYearId: sy.id,
    metadata: {
      price_annual: 7500,
      features: [
        'Personalized learning plans',
        'Small class sizes',
        '3 days a week on site',
        'Academic coaching',
        'Progress tracking',
      ],
    },
  },
  {
    name: 'Virtual Homeschool Support',
    type: 'virtual',
    description: 'Full-service virtual homeschool support with certified academic coaches, curriculum planning, and weekly check-ins.',
    tuitionAmount: '199.00',
    billingCycle: 'monthly',
    status: 'active',
    schoolYearId: sy.id,
    metadata: {
      price_2x: 299,
      features: [
        'Weekly coach sessions',
        'Curriculum guidance',
        'Resource library',
        'Parent reports',
        'Flexible scheduling',
      ],
    },
  },
  {
    name: 'Performance Training',
    type: 'athletic',
    description: 'Elite athletic and mental performance training designed to develop peak performers in sport and academics.',
    tuitionAmount: '500.00',
    billingCycle: 'monthly',
    status: 'active',
    schoolYearId: sy.id,
    metadata: {
      price_annual: 5000,
      features: [
        '4x/week - elite performance training',
        'Strength & conditioning',
        'Mental performance',
        'Nutrition guidance',
        'Performance analytics',
        'D1 and NIL coaching',
      ],
    },
  },
  {
    name: 'Combination Program',
    type: 'combined',
    description: 'Combine Performance Training with an academic program and save 10%. The ultimate package for students who want elite athletic development alongside rigorous academic support.',
    tuitionAmount: '1125.00',
    billingCycle: 'monthly',
    status: 'active',
    schoolYearId: sy.id,
    metadata: {
      badge: 'SAVE 10%',
      variants: [
        { name: 'Hybrid Microschool Combination', price_monthly: 1125, price_annual: 11250 },
        { name: 'Virtual Combination 1 Session / Week', price_monthly: 629 },
        { name: 'Virtual Combination 2 Sessions / Week', price_monthly: 719 },
      ],
      features: [
        'Everything in Performance Training',
        'Academic program included',
        '10% bundle savings',
        'Unified coaching team',
        'Holistic progress tracking',
      ],
    },
  },
];

const insertedPrograms = await db.insert(programs).values(programData).returning();
console.log(`✓ Programs inserted: ${insertedPrograms.length}`);
insertedPrograms.forEach(p => console.log(`  - ${p.name} (id: ${p.id})`));

// ── Sections ──────────────────────────────────────────────────────────────────
const hybrid = insertedPrograms.find(p => p.name === 'Hybrid Microschool');
const virtual = insertedPrograms.find(p => p.name === 'Virtual Homeschool Support');
const athletic = insertedPrograms.find(p => p.name === 'Performance Training');
const combo = insertedPrograms.find(p => p.name === 'Combination Program');

const sectionData = [];

if (hybrid) {
  sectionData.push(
    { programId: hybrid.id, name: 'Grades K–2', capacity: 10, schedule: { days: ['Mon','Tue','Thu'], time: '9:00-10:30 AM' }, schoolYearId: sy.id },
    { programId: hybrid.id, name: 'Grades 3–5', capacity: 10, schedule: { days: ['Mon','Tue','Thu'], time: '11:00 AM-12:30 PM' }, schoolYearId: sy.id },
    { programId: hybrid.id, name: 'Grades 6–8', capacity: 10, schedule: { days: ['Mon','Tue','Thu'], time: '9:00-10:30 AM' }, schoolYearId: sy.id },
    { programId: hybrid.id, name: 'Grades 9–12', capacity: 10, schedule: { days: ['Mon','Tue','Thu'], time: '1:00-2:30 PM' }, schoolYearId: sy.id },
  );
}

if (virtual) {
  sectionData.push(
    { programId: virtual.id, name: 'Cohort A — 1x Weekly (Monday)', capacity: 8, schedule: { days: ['Monday'], time: '10:00 AM-12:00 PM', room: 'Zoom' }, schoolYearId: sy.id },
    { programId: virtual.id, name: 'Cohort B — 1x Weekly (Wednesday)', capacity: 8, schedule: { days: ['Wednesday'], time: '10:00 AM-12:00 PM', room: 'Zoom' }, schoolYearId: sy.id },
    { programId: virtual.id, name: 'Cohort A — 2x Weekly (Mon/Wed)', capacity: 8, schedule: { days: ['Monday','Wednesday'], time: '10:00 AM-12:00 PM', room: 'Zoom' }, schoolYearId: sy.id },
    { programId: virtual.id, name: 'Cohort B — 2x Weekly (Tue/Thu)', capacity: 8, schedule: { days: ['Tuesday','Thursday'], time: '10:00 AM-12:00 PM', room: 'Zoom' }, schoolYearId: sy.id },
  );
}

if (athletic) {
  sectionData.push(
    { programId: athletic.id, name: 'Strength & Conditioning', capacity: 20, schedule: { days: ['Mon','Tue','Thu','Fri'], time: '2:00-4:00 PM', room: 'Athletic Center' }, schoolYearId: sy.id },
    { programId: athletic.id, name: 'Speed & Agility', capacity: 20, schedule: { days: ['Mon','Wed','Fri'], time: '4:00-5:00 PM', room: 'Athletic Center' }, schoolYearId: sy.id },
    { programId: athletic.id, name: 'Mental Performance & NIL', capacity: 15, schedule: { days: ['Friday'], time: '10:00-11:30 AM', room: 'Conference Room' }, schoolYearId: sy.id },
  );
}

if (combo) {
  sectionData.push(
    { programId: combo.id, name: 'Combo — Hybrid + Performance', capacity: 10, schedule: { days: ['Mon','Tue','Thu'], time: 'Full Day' }, schoolYearId: sy.id },
    { programId: combo.id, name: 'Combo — Virtual 1x + Performance', capacity: 8, schedule: { days: ['Mon','Thu'], time: 'Combined' }, schoolYearId: sy.id },
    { programId: combo.id, name: 'Combo — Virtual 2x + Performance', capacity: 8, schedule: { days: ['Mon','Tue','Thu'], time: 'Combined' }, schoolYearId: sy.id },
  );
}

if (sectionData.length) {
  const insertedSections = await db.insert(sections).values(sectionData).returning();
  console.log(`\n✓ Sections inserted: ${insertedSections.length}`);
}

console.log('\n✅ Done! Programs and sections are ready.');
await pool.end();
