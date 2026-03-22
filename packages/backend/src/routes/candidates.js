import { Router } from "express";
import { pool } from "../config/db.js";
import { requireAuth } from "../middleware/auth.js";

export const candidatesRouter = Router();
candidatesRouter.use(requireAuth);

// ── GET /api/candidates ──────────────────────────────────────────────────────
candidatesRouter.get("/", async (req, res, next) => {
  try {
    const { page = 1, limit = 20, q } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const search = `%${q || ""}%`;

    const { rows } = await pool.query(
      `SELECT c.*, COUNT(a.id)::int AS application_count
       FROM candidates c
       LEFT JOIN applications a ON a.candidate_id = c.id
       WHERE c.name ILIKE $1 OR c.email ILIKE $1
       GROUP BY c.id
       ORDER BY c.created_at DESC
       LIMIT $2 OFFSET $3`,
      [search, Number(limit), offset]
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// ── GET /api/candidates/:id ──────────────────────────────────────────────────
candidatesRouter.get("/:id", async (req, res, next) => {
  try {
    const { rows } = await pool.query("SELECT * FROM candidates WHERE id = $1", [req.params.id]);
    if (!rows[0]) return res.status(404).json({ success: false, error: "Candidate not found" });

    // Application history
    const { rows: apps } = await pool.query(
      `SELECT a.id, a.stage, a.source, a.score, a.applied_at, j.title AS job_title
       FROM applications a
       JOIN jobs j ON a.job_id = j.id
       WHERE a.candidate_id = $1
       ORDER BY a.applied_at DESC`,
      [req.params.id]
    );

    res.json({ success: true, data: { ...rows[0], applications: apps } });
  } catch (err) { next(err); }
});

// ── POST /api/candidates ─────────────────────────────────────────────────────
candidatesRouter.post("/", async (req, res, next) => {
  try {
    const { name, email, phone, city, state, resume_url, linkedin, notes } = req.body;
    if (!name)  return res.status(400).json({ success: false, error: "name is required" });
    if (!email) return res.status(400).json({ success: false, error: "email is required" });

    const { rows } = await pool.query(
      `INSERT INTO candidates (name, email, phone, city, state, resume_url, linkedin, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [name, email, phone || null, city || null, state || null, resume_url || null, linkedin || null, notes || null]
    );
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ success: false, error: "A candidate with this email already exists" });
    }
    next(err);
  }
});

// ── PUT /api/candidates/:id ──────────────────────────────────────────────────
candidatesRouter.put("/:id", async (req, res, next) => {
  try {
    const { name, email, phone, city, state, resume_url, linkedin, notes } = req.body;
    const { rows } = await pool.query(
      `UPDATE candidates
       SET name=$1, email=$2, phone=$3, city=$4, state=$5,
           resume_url=$6, linkedin=$7, notes=$8, updated_at=NOW()
       WHERE id=$9 RETURNING *`,
      [name, email, phone, city, state, resume_url, linkedin, notes, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ success: false, error: "Candidate not found" });
    res.json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
});
