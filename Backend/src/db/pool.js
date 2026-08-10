import pg from "pg";

const { Pool } = pg;

// Neon requires SSL. rejectUnauthorized: false is the standard setting for
// Neon's managed certs — fine for this project; a stricter CA setup is
// something to revisit if this ever moves to a different Postgres host.
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Quick helper so route files don't each import pg directly.
export function query(text, params) {
  return pool.query(text, params);
}
