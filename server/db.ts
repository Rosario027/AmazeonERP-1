import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '@shared/schema';

// Load .env only if DATABASE_URL not already provided and we're not in production.
// This avoids a hard runtime crash in production environments where dotenv might be absent.
if (!process.env.DATABASE_URL && process.env.NODE_ENV !== 'production') {
  try {
    await import('dotenv/config');
  } catch (e) {
    // Silently ignore if dotenv is not installed; user must supply env vars manually.
  }
}

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be set (env var missing).');
}

export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });
