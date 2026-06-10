import { Pool } from 'pg';

let pool: Pool;

export function getDbPool() {
  if (!pool) {
    const connectionString = process.env.SUPABASE_DB_URL;
    const isLocal = connectionString?.includes('localhost') || connectionString?.includes('127.0.0.1') || connectionString?.includes('5433');
    pool = new Pool({
      connectionString,
      ssl: isLocal ? false : {
        rejectUnauthorized: false,
      },
    });
  }
  return pool;
}
