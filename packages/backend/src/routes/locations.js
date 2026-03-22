import { Router } from "express";
import { pool } from "../config/db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const locationsRouter = Router();
locationsRouter.use(requireAuth);

locationsRouter.get("/", async (req, res, next) => {
  try {
    const { q } = req.query;
    // Always use parameterized queries — never string interpolation (SQL injection prevention)
    const { rows } = await pool.query(
      `SELECT * FROM locations
       WHERE ($1::text IS NULL OR city ILIKE $2 OR state ILIKE $2)
       ORDER BY city`,
      [q || null, q ? `%${q}%` : null]
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

locationsRouter.post("/", async (req, res, next) => {
  try {
    const { city, state, country, is_remote } = req.body;
    if (!city)    return res.status(400).json({ success: false, error: "city is required" });
    if (!country) return res.status(400).json({ success: false, error: "country is required" });

    const { rows } = await pool.query(
      "INSERT INTO locations (city, state, country, is_remote) VALUES ($1,$2,$3,$4) RETURNING *",
      [city, state || null, country, is_remote ?? false]
    );
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
});

locationsRouter.put("/:id", requireRole("admin", "recruiter_admin"), async (req, res, next) => {
  try {
    const { city, state, country, is_remote } = req.body;
    if (!city)    return res.status(400).json({ success: false, error: "city is required" });
    if (!country) return res.status(400).json({ success: false, error: "country is required" });

    const { rows } = await pool.query(
      "UPDATE locations SET city=$1, state=$2, country=$3, is_remote=$4 WHERE id=$5 RETURNING *",
      [city, state || null, country, is_remote ?? false, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ success: false, error: "Location not found" });
    res.json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
});

locationsRouter.delete("/:id", requireRole("admin", "recruiter_admin"), async (req, res, next) => {
  try {
    await pool.query("DELETE FROM locations WHERE id = $1", [req.params.id]);
    res.json({ success: true });
  } catch (err) { next(err); }
});
