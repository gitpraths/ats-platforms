import { Router } from "express";
import { pool } from "../config/db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const departmentsRouter = Router();
departmentsRouter.use(requireAuth);

departmentsRouter.get("/", async (req, res, next) => {
  try {
    const { rows } = await pool.query("SELECT * FROM departments ORDER BY name");
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

departmentsRouter.post("/", async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ success: false, error: "name is required" });

    const existing = await pool.query("SELECT id FROM departments WHERE LOWER(name) = LOWER($1)", [name]);
    if (existing.rows[0]) return res.status(409).json({ success: false, error: "Department already exists" });

    const { rows } = await pool.query(
      "INSERT INTO departments (name) VALUES ($1) RETURNING *",
      [name]
    );
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
});

departmentsRouter.put("/:id", requireRole("admin", "recruiter_admin"), async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ success: false, error: "name is required" });

    const { rows } = await pool.query(
      "UPDATE departments SET name=$1 WHERE id=$2 RETURNING *",
      [name, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ success: false, error: "Department not found" });
    res.json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
});

departmentsRouter.delete("/:id", requireRole("admin", "recruiter_admin"), async (req, res, next) => {
  try {
    await pool.query("DELETE FROM departments WHERE id = $1", [req.params.id]);
    res.json({ success: true });
  } catch (err) { next(err); }
});
