import { Router } from "express";
import { pool } from "../config/db.js";
import { requireAuth } from "../middleware/auth.js";

export const consultantsRouter = Router();
consultantsRouter.use(requireAuth);

// GET /api/consultants?provider_id=xxx
consultantsRouter.get("/", async (req, res, next) => {
  try {
    const { provider_id } = req.query;
    const conditions = ["c.is_active = TRUE"];
    const params = [];
    if (provider_id) {
      params.push(provider_id);
      conditions.push(`c.provider_id = $${params.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const { rows } = await pool.query(
      `SELECT c.*, p.name AS provider_name
       FROM consultants c
       LEFT JOIN providers p ON c.provider_id = p.id
       ${where}
       ORDER BY c.name ASC`,
      params
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// POST /api/consultants
consultantsRouter.post("/", async (req, res, next) => {
  try {
    const { provider_id, name, email, phone } = req.body;
    if (!provider_id) return res.status(400).json({ success: false, error: "provider_id is required" });
    if (!name)        return res.status(400).json({ success: false, error: "name is required" });
    const { rows } = await pool.query(
      `INSERT INTO consultants (provider_id, name, email, phone)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [provider_id, name.trim(), email || null, phone || null]
    );
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
});

// PATCH /api/consultants/:id
consultantsRouter.patch("/:id", async (req, res, next) => {
  try {
    const { name, email, phone, is_active } = req.body;
    const { rows } = await pool.query(
      `UPDATE consultants SET
         name      = COALESCE($1, name),
         email     = COALESCE($2, email),
         phone     = COALESCE($3, phone),
         is_active = COALESCE($4, is_active)
       WHERE id = $5 RETURNING *`,
      [name || null, email || null, phone || null, is_active ?? null, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ success: false, error: "Consultant not found" });
    res.json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
});

// DELETE /api/consultants/:id
consultantsRouter.delete("/:id", async (req, res, next) => {
  try {
    await pool.query("UPDATE consultants SET is_active = FALSE WHERE id = $1", [req.params.id]);
    res.json({ success: true });
  } catch (err) { next(err); }
});
