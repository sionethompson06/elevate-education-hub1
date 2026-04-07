import 'dotenv/config';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import pg from 'pg';
import * as schema from './schema.js';

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('[DB] ERROR: DATABASE_URL environment variable is not set.');
}

// rawSql is the low-level executor for DDL/raw queries (bypasses Drizzle adapter quirks)
// For Neon: the neon() tagged-template function
// For local pg: a thin wrapper around pool.query
export let rawSql = null;

// Use Neon serverless HTTP driver for cloud/serverless (Vercel, Replit)
// Fall back to standard pg pool for local development
function createDb() {
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set. Configure it in your environment variables.');
  }
  // Neon URLs contain "neon.tech" — use the serverless HTTP driver
  if (connectionString.includes('neon.tech') || connectionString.includes('neondb')) {
    const neonClient = neon(connectionString);
    rawSql = neonClient;
    return drizzleNeon(neonClient, { schema });
  }
  // Local PostgreSQL — use standard pg pool
  const pool = new Pool({ connectionString });
  rawSql = async (strings, ...values) => {
    const text = strings.reduce((acc, str, i) => acc + str + (i < values.length ? `$${i + 1}` : ''), '');
    const result = await pool.query(text, values);
    return result.rows;
  };
  return drizzlePg(pool, { schema });
}

export const db = createDb();
export default db;
