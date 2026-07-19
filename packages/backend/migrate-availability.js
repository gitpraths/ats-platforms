import { pool } from "./src/config/db.js";

async function run() {
  try {
    console.log("Adding availability column...");
    await pool.query("ALTER TABLE candidates ADD COLUMN IF NOT EXISTS availability TEXT;");
    console.log("Success!");
  } catch (err) {
    console.error("Error:", err);
  } finally {
    process.exit(0);
  }
}

run();
