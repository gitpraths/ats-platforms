import { Router } from "express";
import { pool } from "../config/db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { validateJobStatusTransition } from "../utils/index.js";

export const jobsRouter = Router();
jobsRouter.use(requireAuth);

const VALID_JOB_TYPES   = ["full_time", "part_time", "contract", "internship"];
const VALID_WORK_MODELS = ["onsite", "remote", "hybrid"];
const VALID_CURRENCIES  = ["USD", "EUR", "CAD", "MXN"];
const VALID_STATUSES    = ["draft", "published", "archived"];

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getRecruiters(jobId) {
  const { rows } = await pool.query(
    `SELECT u.id, u.name, u.email
     FROM job_recruiter jr
     JOIN users u ON jr.user_id = u.id
     WHERE jr.job_id = $1`,
    [jobId]
  );
  return rows;
}

// ── GET /api/jobs ─────────────────────────────────────────────────────────────
jobsRouter.get("/", async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, department_id, location_id, job_type, work_model, team, title } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const params = [];
    const conditions = [];

    if (status)        { params.push(status);        conditions.push(`j.status = $${params.length}`); }
    if (department_id) { params.push(department_id); conditions.push(`j.department_id = $${params.length}`); }
    if (location_id)   { params.push(location_id);   conditions.push(`j.location_id = $${params.length}`); }
    if (job_type)      { params.push(job_type);       conditions.push(`j.job_type = $${params.length}`); }
    if (work_model)    { params.push(work_model);     conditions.push(`j.work_model = $${params.length}`); }
    if (team)          { params.push(team);           conditions.push(`j.team = $${params.length}`); }
    if (title)         { params.push(`%${title}%`);  conditions.push(`j.title ILIKE $${params.length}`); }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    params.push(Number(limit), offset);

    const { rows } = await pool.query(
      `SELECT j.*,
              d.name AS department_name,
              l.city, l.state, l.country, l.is_remote,
              u.name AS created_by_name,
              COUNT(DISTINCT a.id)::int AS application_count
       FROM jobs j
       LEFT JOIN departments d  ON j.department_id = d.id
       LEFT JOIN locations   l  ON j.location_id   = l.id
       LEFT JOIN users       u  ON j.created_by    = u.id
       LEFT JOIN applications a ON a.job_id        = j.id
       ${where}
       GROUP BY j.id, d.name, l.city, l.state, l.country, l.is_remote, u.name
       ORDER BY j.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    // Attach recruiters to each job
    const jobs = await Promise.all(
      rows.map(async (job) => ({ ...job, recruiters: await getRecruiters(job.id) }))
    );

    res.json({ success: true, data: jobs });
  } catch (err) { next(err); }
});

// ── GET /api/jobs/:id ─────────────────────────────────────────────────────────
jobsRouter.get("/:id", async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT j.*,
              d.name AS department_name,
              l.city, l.state, l.country, l.is_remote,
              u.name AS created_by_name
       FROM jobs j
       LEFT JOIN departments d ON j.department_id = d.id
       LEFT JOIN locations   l ON j.location_id   = l.id
       LEFT JOIN users       u ON j.created_by    = u.id
       WHERE j.id = $1`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ success: false, error: "Job not found" });

    const job = { ...rows[0], recruiters: await getRecruiters(req.params.id) };
    res.json({ success: true, data: job });
  } catch (err) { next(err); }
});

// ── POST /api/jobs ────────────────────────────────────────────────────────────
jobsRouter.post("/", async (req, res, next) => {
  try {
    const {
      title, description, department_id, location_id,
      skills_required, skills_desired,
      job_type, work_model,
      cover_letter_required, min_annual_salary, max_annual_salary, currency_code,
      experience_years_min, deadline, team,
      employer_id, positions_count, job_board_url, vacancy_type, staff_working_status,
    } = req.body;

    if (!title)      return res.status(400).json({ success: false, error: "title is required" });
    if (!job_type)   return res.status(400).json({ success: false, error: "job_type is required" });
    if (!work_model) return res.status(400).json({ success: false, error: "work_model is required" });

    if (job_type && !VALID_JOB_TYPES.includes(job_type))
      return res.status(400).json({ success: false, error: `job_type must be one of: ${VALID_JOB_TYPES.join(", ")}` });
    if (work_model && !VALID_WORK_MODELS.includes(work_model))
      return res.status(400).json({ success: false, error: `work_model must be one of: ${VALID_WORK_MODELS.join(", ")}` });
    if (currency_code && !VALID_CURRENCIES.includes(currency_code))
      return res.status(400).json({ success: false, error: `currency_code must be one of: ${VALID_CURRENCIES.join(", ")}` });

    const { rows } = await pool.query(
      `INSERT INTO jobs (
         title, description, department_id, location_id,
         skills_required, skills_desired,
         job_type, work_model,
         cover_letter_required, min_annual_salary, max_annual_salary, currency_code,
         experience_years_min, deadline, team,
         employer_id, positions_count, job_board_url, vacancy_type, staff_working_status,
         status, created_by, updated_by
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,
         $16,$17,$18,$19,$20,
         'draft', $21, $21
       ) RETURNING id, job_number, created_at`,
      [
        title, description, department_id || null, location_id || null,
        skills_required || [], skills_desired || [],
        job_type, work_model,
        cover_letter_required ?? false,
        min_annual_salary || null, max_annual_salary || null, currency_code || "AUD",
        experience_years_min || null, deadline || null, team || null,
        employer_id || null, positions_count || 1, job_board_url || null,
        vacancy_type || null, staff_working_status || "active",
        req.user.id,
      ]
    );
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
});

// ── PATCH /api/jobs/:id ───────────────────────────────────────────────────────
jobsRouter.patch("/:id", async (req, res, next) => {
  try {
    const allowed = [
      "title", "description", "department_id", "location_id",
      "skills_required", "skills_desired", "job_type", "work_model",
      "cover_letter_required", "min_annual_salary", "max_annual_salary", "currency_code",
      "experience_years_min", "deadline", "team",
      "employer_id", "positions_count", "job_board_url", "vacancy_type", "staff_working_status",
    ];

    const updates = [];
    const params  = [];

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        params.push(req.body[key]);
        updates.push(`${key} = $${params.length}`);
      }
    }

    if (updates.length === 0)
      return res.status(400).json({ success: false, error: "No updatable fields provided" });

    // Validate enums if present
    if (req.body.job_type && !VALID_JOB_TYPES.includes(req.body.job_type))
      return res.status(400).json({ success: false, error: `job_type must be one of: ${VALID_JOB_TYPES.join(", ")}` });
    if (req.body.work_model && !VALID_WORK_MODELS.includes(req.body.work_model))
      return res.status(400).json({ success: false, error: `work_model must be one of: ${VALID_WORK_MODELS.join(", ")}` });

    params.push(req.user.id, req.params.id);
    const { rows } = await pool.query(
      `UPDATE jobs SET ${updates.join(", ")}, updated_at = NOW(), updated_by = $${params.length - 1}
       WHERE id = $${params.length} RETURNING *`,
      params
    );
    if (!rows[0]) return res.status(404).json({ success: false, error: "Job not found" });

    const job = { ...rows[0], recruiters: await getRecruiters(req.params.id) };
    res.json({ success: true, data: job });
  } catch (err) { next(err); }
});

// ── PATCH /api/jobs/:id/status ────────────────────────────────────────────────
jobsRouter.patch("/:id/status", async (req, res, next) => {
  try {
    const { job_status, comment } = req.body;
    if (!job_status) return res.status(400).json({ success: false, error: "job_status is required" });
    if (!VALID_STATUSES.includes(job_status))
      return res.status(400).json({ success: false, error: `job_status must be one of: ${VALID_STATUSES.join(", ")}` });

    const jobCheck = await pool.query("SELECT id, status FROM jobs WHERE id = $1", [req.params.id]);
    if (!jobCheck.rows[0]) return res.status(404).json({ success: false, error: "Job not found" });

    validateJobStatusTransition(jobCheck.rows[0].status, job_status);

    await pool.query("UPDATE jobs SET status = $1, updated_at = NOW() WHERE id = $2", [job_status, req.params.id]);

    const { rows } = await pool.query(
      `INSERT INTO job_activity (job_id, user_id, job_status, comment)
       VALUES ($1, $2, $3, $4) RETURNING user_id, job_status, created_at`,
      [req.params.id, req.user.id, job_status, comment || null]
    );
    res.json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
});

// ── POST /api/jobs/:id/recruiters ─────────────────────────────────────────────
jobsRouter.post("/:id/recruiters", async (req, res, next) => {
  try {
    const { user_ids } = req.body;
    if (!Array.isArray(user_ids) || user_ids.length === 0)
      return res.status(400).json({ success: false, error: "user_ids array is required" });

    const job = await pool.query("SELECT created_by FROM jobs WHERE id = $1", [req.params.id]);
    if (!job.rows[0]) return res.status(404).json({ success: false, error: "Job not found" });
    if (job.rows[0].created_by !== req.user.id)
      return res.status(403).json({ success: false, error: "Only the job owner can assign recruiters" });

    // Validate all user_ids are valid recruiters
    const { rows: validUsers } = await pool.query(
      `SELECT id FROM users WHERE id = ANY($1::uuid[]) AND role IN ('recruiter', 'recruiter_admin')`,
      [user_ids]
    );
    const validIds = validUsers.map((u) => u.id);

    for (const uid of validIds) {
      await pool.query(
        "INSERT INTO job_recruiter (job_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [req.params.id, uid]
      );
    }

    const recruiters = await getRecruiters(req.params.id);
    res.json({ success: true, data: { user_ids: recruiters.map((r) => r.id) } });
  } catch (err) { next(err); }
});

// ── DELETE /api/jobs/:id/recruiters ───────────────────────────────────────────
jobsRouter.delete("/:id/recruiters", async (req, res, next) => {
  try {
    const { user_ids } = req.body;
    if (!Array.isArray(user_ids) || user_ids.length === 0)
      return res.status(400).json({ success: false, error: "user_ids array is required" });

    const job = await pool.query("SELECT created_by FROM jobs WHERE id = $1", [req.params.id]);
    if (!job.rows[0]) return res.status(404).json({ success: false, error: "Job not found" });
    if (job.rows[0].created_by !== req.user.id)
      return res.status(403).json({ success: false, error: "Only the job owner can remove recruiters" });

    await pool.query(
      "DELETE FROM job_recruiter WHERE job_id = $1 AND user_id = ANY($2::uuid[])",
      [req.params.id, user_ids]
    );

    const recruiters = await getRecruiters(req.params.id);
    res.json({ success: true, data: { user_ids: recruiters.map((r) => r.id) } });
  } catch (err) { next(err); }
});

// ── GET /api/jobs/:id/activity ────────────────────────────────────────────────
jobsRouter.get("/:id/activity", async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT ja.id, ja.job_status, ja.comment, ja.created_at,
              u.name AS user_name, u.email AS user_email
       FROM job_activity ja
       LEFT JOIN users u ON ja.user_id = u.id
       WHERE ja.job_id = $1
       ORDER BY ja.created_at DESC`,
      [req.params.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// ── DELETE /api/jobs/:id ──────────────────────────────────────────────────────
jobsRouter.delete("/:id", async (req, res, next) => {
  try {
    const { rows: jobRows } = await pool.query("SELECT created_by FROM jobs WHERE id = $1", [req.params.id]);
    if (!jobRows[0]) return res.status(404).json({ success: false, error: "Job not found" });
    if (jobRows[0].created_by !== req.user.id && req.user.role !== "admin")
      return res.status(403).json({ success: false, error: "Only the job owner or an admin can delete this job" });

    const { rows } = await pool.query("DELETE FROM jobs WHERE id = $1 RETURNING id", [req.params.id]);
    res.json({ success: true, data: { id: rows[0].id, status: "DELETED" } });
  } catch (err) { next(err); }
});
