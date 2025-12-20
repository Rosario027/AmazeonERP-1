import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '@shared/schema';

// Load .env file for development environment
if (process.env.NODE_ENV !== 'production') {
  try {
    await import('dotenv/config');
  } catch (e) {
    // Silently ignore if dotenv is not installed; user must supply env vars manually.
  }
}

if (!process.env.DATABASE_URL) {
  console.error('FATAL: DATABASE_URL environment variable is not set.');
  console.error('Please ensure DATABASE_URL is configured in your deployment environment.');
  throw new Error('DATABASE_URL must be set (env var missing).');
}

console.log('Connecting to database...');
export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });
console.log('Database connection pool created.');
