import { Pool } from 'pg';

let pool: Pool;

export function getDbPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.SUPABASE_DB_URL,
      ssl: {
        rejectUnauthorized: false,
      },
    });
  }
  return pool;
}
