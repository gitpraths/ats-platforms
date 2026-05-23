import pg from "pg";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error("FATAL: DATABASE_URL environment variable is not set");
  process.exit(1);
}

// Enable SSL for any non-localhost database (Railway, Supabase, etc.)
const isRemoteDb = !process.env.DATABASE_URL.includes("localhost") &&
                   !process.env.DATABASE_URL.includes("127.0.0.1");

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isRemoteDb ? { rejectUnauthorized: false } : false,
});

pool.on("error", (err) => {
  console.error("Unexpected DB client error", err);
});
