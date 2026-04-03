import { Router } from "express";
import { pool } from "../config/db.js";
import { requireAuth } from "../middleware/auth.js";

export const applicationsRouter = Router();
applicationsRouter.use(requireAuth);

const VALID_STAGES = ["applied", "screening", "interview", "offer", "hired", "rejected"];

// ── GET /api/applications ────────────────────────────────────────────────────
// Supports filters: job_id, candidate (name search), job_title (title search)
applicationsRouter.get("/", async (req, res, next) => {
  try {
    const { candidate, job_title, job_id } = req.query;
    const isAdmin = ["admin", "recruiter_admin"].includes(req.user.role);
    const params = isAdmin ? [] : [req.user.id];
    const conditions = isAdmin ? [] : [
      `(j.created_by = $1 OR EXISTS (
         SELECT 1 FROM job_recruiter jr WHERE jr.job_id = j.id AND jr.user_id = $1
       ))`
    ];

    if (job_id)    { params.push(job_id);             conditions.push(`a.job_id = $${params.length}`); }
    if (candidate) { params.push(`%${candidate}%`);   conditions.push(`c.name ILIKE $${params.length}`); }
    if (job_title) { params.push(`%${job_title}%`);   conditions.push(`j.title ILIKE $${params.length}`); }

    const { rows } = await pool.query(
      `SELECT
         a.id, a.candidate_id, a.job_id, a.stage, a.source, a.score, a.notes,
         a.applied_at, a.updated_at,
         j.title        AS job_title,
         j.job_number   AS job_number,
         j.status       AS job_status,
         c.name         AS candidate_name,
         c.email        AS candidate_email,
         c.city         AS candidate_city,
         c.state        AS candidate_state,
         d.name         AS department_name,
         l.city, l.state, l.country, l.is_remote
       FROM applications a
       JOIN jobs       j ON a.job_id       = j.id
       JOIN candidates c ON a.candidate_id = c.id
       LEFT JOIN departments d ON j.department_id = d.id
       LEFT JOIN locations   l ON j.location_id   = l.id
       ${conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""}
       ORDER BY a.applied_at DESC`,
      params
    );

    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// ── POST /api/applications ───────────────────────────────────────────────────
applicationsRouter.post("/", async (req, res, next) => {
  try {
    const { job_id, candidate_id, source } = req.body;
    if (!job_id || !candidate_id)
      return res.status(400).json({ success: false, error: "job_id and candidate_id are required" });

    const { rows } = await pool.query(
      `INSERT INTO applications (job_id, candidate_id, stage, source, score)
       VALUES ($1, $2, 'applied', $3, 0) RETURNING *`,
      [job_id, candidate_id, source || "manual"]
    );
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ success: false, error: "Candidate already applied to this job" });
    }
    next(err);
  }
});

// ── PATCH /api/applications/:id ──────────────────────────────────────────────
applicationsRouter.patch("/:id", async (req, res, next) => {
  try {
    const { stage, score, notes } = req.body;

    // Verify user is recruiter for this application's job
    const { rows: appRows } = await pool.query(
      `SELECT a.*, j.created_by FROM applications a JOIN jobs j ON a.job_id = j.id WHERE a.id = $1`,
      [req.params.id]
    );
    if (!appRows[0]) return res.status(404).json({ success: false, error: "Application not found" });

    const isAdmin = ["admin", "recruiter_admin"].includes(req.user.role);
    const isOwner = appRows[0].created_by === req.user.id;
    const { rows: recruiterRows } = await pool.query(
      "SELECT 1 FROM job_recruiter WHERE job_id = $1 AND user_id = $2",
      [appRows[0].job_id, req.user.id]
    );
    const isRecruiter = recruiterRows.length > 0;

    if (!isAdmin && !isOwner && !isRecruiter)
      return res.status(403).json({ success: false, error: "You are not authorized to update this application" });

    if (stage && !VALID_STAGES.includes(stage))
      return res.status(400).json({ success: false, error: `stage must be one of: ${VALID_STAGES.join(", ")}` });

    const updates = [];
    const params  = [];
    if (stage !== undefined) { params.push(stage); updates.push(`stage = $${params.length}`); }
    if (score !== undefined) { params.push(score); updates.push(`score = $${params.length}`); }
    if (notes !== undefined) { params.push(notes); updates.push(`notes = $${params.length}`); }

    if (updates.length === 0)
      return res.status(400).json({ success: false, error: "No updatable fields provided" });

    params.push(req.params.id);
    const { rows } = await pool.query(
      `UPDATE applications SET ${updates.join(", ")}, updated_at = NOW() WHERE id = $${params.length} RETURNING *`,
      params
    );
    res.json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
});

// ── DELETE /api/applications/:id ─────────────────────────────────────────────
applicationsRouter.delete("/:id", async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      "DELETE FROM applications WHERE id = $1 RETURNING id",
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ success: false, error: "Application not found" });
    res.json({ success: true, data: { id: rows[0].id, status: "DELETED" } });
  } catch (err) { next(err); }
});
