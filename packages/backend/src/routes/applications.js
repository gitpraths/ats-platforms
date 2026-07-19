import { Router } from "express";
import { pool } from "../config/db.js";
import { requireAuth } from "../middleware/auth.js";

export const applicationsRouter = Router();
applicationsRouter.use(requireAuth);

const VALID_STAGES = ["applied", "screening", "interview", "ets", "hired", "rejected"];

// ── GET /api/applications ────────────────────────────────────────────────────
// Supports filters: job_id, candidate (name search), job_title (title search)
applicationsRouter.get("/", async (req, res, next) => {
  try {
    const { candidate, job_title, job_id, candidate_id } = req.query;
    const isAdmin = ["admin", "recruiter_admin"].includes(req.user.role);
    const params = isAdmin ? [] : [req.user.id];
    const conditions = isAdmin ? [] : [
      `(j.created_by = $1 OR EXISTS (
         SELECT 1 FROM job_recruiter jr WHERE jr.job_id = j.id AND jr.user_id = $1
       ))`
    ];

    if (job_id)      { params.push(job_id);             conditions.push(`a.job_id = $${params.length}`); }
    if (candidate_id){ params.push(candidate_id);        conditions.push(`a.candidate_id = $${params.length}`); }
    if (candidate)   { params.push(`%${candidate}%`);   conditions.push(`c.name ILIKE $${params.length}`); }
    if (job_title)   { params.push(`%${job_title}%`);   conditions.push(`j.title ILIKE $${params.length}`); }

    const { rows } = await pool.query(
      `SELECT
         a.id, a.candidate_id, a.job_id, a.stage, a.source, a.score, a.notes,
         a.applied_at, a.updated_at, a.interview_date, a.ets_date, a.placement_date,
         j.title        AS job_title,
         j.job_number   AS job_number,
         j.status       AS job_status,
         c.name         AS candidate_name,
         c.email        AS candidate_email,
         c.city         AS candidate_city,
         c.state        AS candidate_state,
         d.name         AS department_name,
         e.name         AS employer_name,
         l.city, l.state, l.country, l.is_remote
       FROM applications a
       JOIN jobs       j ON a.job_id       = j.id
       JOIN candidates c ON a.candidate_id = c.id
       LEFT JOIN employers e ON j.employer_id = e.id
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
    const { job_id, candidate_id, source, stage, interview_date, ets_date, placement_date, applied_at } = req.body;
    if (!job_id || !candidate_id)
      return res.status(400).json({ success: false, error: "job_id and candidate_id are required" });

    // Build dynamic insert to handle optional dates
    const cols = ["job_id", "candidate_id", "source", "score", "stage"];
    const vals = [job_id, candidate_id, source || "manual", 0, stage || "applied"];
    
    if (interview_date) { cols.push("interview_date"); vals.push(interview_date); }
    if (ets_date)       { cols.push("ets_date");       vals.push(ets_date); }
    if (placement_date) { cols.push("placement_date"); vals.push(placement_date); }
    if (applied_at)     { cols.push("applied_at");     vals.push(applied_at); }

    const placeholders = vals.map((_, i) => `$${i + 1}`).join(", ");
    
    const { rows } = await pool.query(
      `INSERT INTO applications (${cols.join(", ")})
       VALUES (${placeholders}) RETURNING *`,
      vals
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
    const { stage, score, notes, interview_date, ets_date, placement_date, applied_at } = req.body;

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

    let targetStage = stage !== undefined ? stage : appRows[0].stage;
    
    // If dates are provided, auto-compute targetStage (unless explicitly rejected)
    if (interview_date !== undefined || ets_date !== undefined || placement_date !== undefined) {
      const finalPlacement = placement_date !== undefined ? placement_date : appRows[0].placement_date;
      const finalEts       = ets_date !== undefined ? ets_date : appRows[0].ets_date;
      const finalInterview = interview_date !== undefined ? interview_date : appRows[0].interview_date;

      let computedStage = "applied";
      if (finalPlacement) computedStage = "hired";
      else if (finalEts) computedStage = "ets";
      else if (finalInterview) computedStage = "interview";

      if (computedStage === "applied" && appRows[0].stage === "screening") {
        computedStage = "screening";
      }

      if (appRows[0].stage !== "rejected") {
        targetStage = computedStage;
      }
    }

    const updates = [];
    const params  = [];
    
    // We only update stage if it changed from the DB, or if explicitly requested
    if (targetStage !== appRows[0].stage || stage !== undefined) {
      params.push(targetStage);
      updates.push(`stage = $${params.length}`);
    }

    if (score !== undefined)          { params.push(score);                  updates.push(`score          = $${params.length}`); }
    if (notes !== undefined)          { params.push(notes);                  updates.push(`notes          = $${params.length}`); }
    if (applied_at !== undefined)     { params.push(applied_at);             updates.push(`applied_at     = $${params.length}`); }
    if (interview_date !== undefined) { params.push(interview_date || null); updates.push(`interview_date = $${params.length}`); }
    if (ets_date !== undefined)       { params.push(ets_date || null);       updates.push(`ets_date       = $${params.length}`); }
    if (placement_date !== undefined) { params.push(placement_date || null); updates.push(`placement_date = $${params.length}`); }

    if (updates.length === 0)
      return res.status(400).json({ success: false, error: "No updatable fields provided" });

    // ── 1-active-placement-at-a-time validation ────────────────────────────────
    if (placement_date) {
      const { rows: existingPlacement } = await pool.query(
        `SELECT id FROM applications
         WHERE candidate_id = $1 AND id != $2 AND placement_date IS NOT NULL`,
        [appRows[0].candidate_id, req.params.id]
      );
      if (existingPlacement.length > 0)
        return res.status(400).json({
          success: false,
          error: "This candidate already has an active placement. Remove it first before adding a new one."
        });
    }

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
