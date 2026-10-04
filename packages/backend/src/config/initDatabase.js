import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcrypt";
import { pool } from "./db.js";
import logger from "./logger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function initDatabase() {
  try {
    // 1. Check if tables are already created
    const { rows: tableCheck } = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'users';
    `);

    if (tableCheck.length === 0) {
      logger.info("[DB Init] Users table not found. Initializing database schema...");
      const schemaPath = path.join(__dirname, "schema.sql");
      if (fs.existsSync(schemaPath)) {
        const sql = fs.readFileSync(schemaPath, "utf8");
        await pool.query(sql);
        logger.info("[DB Init] All database tables created successfully.");
      }
    } else {
      logger.info("[DB Init] Core database tables exist.");
    }

    // 2. Ensure initial admin user exists
    const { rows: userCount } = await pool.query("SELECT COUNT(*) AS count FROM users;");
    if (parseInt(userCount[0].count, 10) === 0) {
      const passwordHash = await bcrypt.hash("Password123!", 10);
      await pool.query(
        `INSERT INTO users (name, email, password_hash, role)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (email) DO NOTHING;`,
        ["WorkVision Admin", "admin@workvision.com.au", passwordHash, "admin"]
      );
      logger.info("[DB Init] Default admin user created (admin@workvision.com.au / Password123!)");
    }

    // 3. Ensure master lookups exist
    await pool.query(`
      INSERT INTO master_industries (name, sort_order) VALUES
        ('Cleaning', 1), ('Warehouse', 2), ('Security', 3), ('Admin', 4),
        ('Call Centre', 5), ('Retail', 6), ('Hospitality', 7), ('Construction', 8),
        ('Logistics', 9), ('Manufacturing', 10), ('Healthcare', 11), ('IT', 12)
      ON CONFLICT (name) DO NOTHING;

      INSERT INTO master_work_types (name, sort_order) VALUES
        ('Full-time', 1), ('Part-time', 2), ('Casual', 3), ('Contract', 4), ('Temporary', 5)
      ON CONFLICT (name) DO NOTHING;

      INSERT INTO master_work_status (name, sort_order) VALUES
        ('Job Seeking', 1), ('Employed', 2), ('Placed', 3), ('Inactive', 4)
      ON CONFLICT (name) DO NOTHING;
    `).catch(() => {});

  } catch (err) {
    logger.error("[DB Init] Error during database initialization: " + err.message);
  }
}
