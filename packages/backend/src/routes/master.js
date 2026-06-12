import { Router } from "express";
import { pool } from "../config/db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

// ── Generic master table router factory ──────────────────────────────────────
function makeMasterRouter(table) {
  const router = Router();
  router.use(requireAuth);

  router.get("/", async (req, res, next) => {
    try {
      const { rows } = await pool.query(
        `SELECT * FROM ${table} ORDER BY sort_order ASC, name ASC`
      );
      res.json({ success: true, data: rows });
    } catch (err) { next(err); }
  });

  router.post("/", requireRole("admin", "recruiter_admin"), async (req, res, next) => {
    try {
      const { name } = req.body;
      if (!name?.trim()) return res.status(400).json({ success: false, error: "name is required" });

      const existing = await pool.query(
        `SELECT id FROM ${table} WHERE LOWER(name) = LOWER($1)`, [name.trim()]
      );
      if (existing.rows[0]) return res.status(409).json({ success: false, error: "Entry already exists" });

      const { rows } = await pool.query(
        `INSERT INTO ${table} (name) VALUES ($1) RETURNING *`, [name.trim()]
      );
      res.status(201).json({ success: true, data: rows[0] });
    } catch (err) { next(err); }
  });

  router.put("/:id", requireRole("admin", "recruiter_admin"), async (req, res, next) => {
    try {
      const { name } = req.body;
      if (!name?.trim()) return res.status(400).json({ success: false, error: "name is required" });

      const { rows } = await pool.query(
        `UPDATE ${table} SET name=$1 WHERE id=$2 RETURNING *`, [name.trim(), req.params.id]
      );
      if (!rows[0]) return res.status(404).json({ success: false, error: "Not found" });
      res.json({ success: true, data: rows[0] });
    } catch (err) { next(err); }
  });

  router.delete("/:id", requireRole("admin", "recruiter_admin"), async (req, res, next) => {
    try {
      await pool.query(`DELETE FROM ${table} WHERE id=$1`, [req.params.id]);
      res.json({ success: true });
    } catch (err) { next(err); }
  });

  return router;
}

export const industriesRouter  = makeMasterRouter("master_industries");
export const workTypesRouter   = makeMasterRouter("master_work_types");
export const workStatusRouter  = makeMasterRouter("master_work_status");
