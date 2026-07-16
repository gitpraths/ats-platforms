import { Router } from "express";
import { pool } from "../config/db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const employersRouter = Router();
employersRouter.use(requireAuth);

// ── GET /api/employers ───────────────────────────────────
employersRouter.get("/", async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search = "", industry = "" } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const like = `%${search}%`;

    const conditions = [`(e.name ILIKE $1 OR e.contact_name ILIKE $1)`];
    const params = [like];
    let idx = 2;

    if (industry) {
      conditions.push(`e.industry ILIKE $${idx}`);
      params.push(`%${industry}%`);
      idx++;
    }

    const where = conditions.join(" AND ");

    const { rows } = await pool.query(
      `SELECT e.*,
              COUNT(DISTINCT j.id) FILTER (WHERE j.status = 'open')::int AS open_jobs_count,
              COUNT(DISTINCT j.id)::int AS total_jobs_count
       FROM employers e
       LEFT JOIN jobs j ON j.employer_id = e.id
       WHERE ${where}
       GROUP BY e.id
       ORDER BY e.name
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, Number(limit), offset]
    );

    const { rows: [{ total }] } = await pool.query(
      `SELECT COUNT(*)::int AS total FROM employers e WHERE ${where}`,
      params
    );

    res.json({ success: true, data: rows, meta: { total, page: Number(page), limit: Number(limit) } });
  } catch (err) { next(err); }
});

// ── GET /api/employers/:id ───────────────────────────────
employersRouter.get("/:id", async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT e.*,
              COUNT(DISTINCT j.id) FILTER (WHERE j.status = 'open')::int AS open_jobs_count,
              COUNT(DISTINCT j.id)::int AS total_jobs_count,
              COUNT(DISTINCT p.id)::int AS total_placements_count
       FROM employers e
       LEFT JOIN jobs j ON j.employer_id = e.id
       LEFT JOIN placements p ON p.employer_id = e.id
       WHERE e.id = $1
       GROUP BY e.id`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ success: false, error: "Employer not found" });

    const { rows: jobs } = await pool.query(
      `SELECT id, title, status, job_type, positions_count
       FROM jobs WHERE employer_id = $1 ORDER BY created_at DESC`,
      [req.params.id]
    );

    const { rows: placements } = await pool.query(
      `SELECT p.id, p.start_date, j.title AS job_title, c.name AS candidate_name
       FROM placements p
       JOIN jobs j ON p.job_id = j.id
       JOIN candidates c ON p.candidate_id = c.id
       WHERE p.employer_id = $1
       ORDER BY p.start_date DESC`,
      [req.params.id]
    );

    res.json({ success: true, data: { ...rows[0], jobs, placements } });
  } catch (err) { next(err); }
});

// ── POST /api/employers ──────────────────────────────────
employersRouter.post("/", requireRole("admin", "recruiter_admin"), async (req, res, next) => {
  try {
    const { name, industry, website, description, contact_name, contact_email, contact_phone, address } = req.body;
    if (!name) return res.status(400).json({ success: false, error: "name is required" });

    const { rows } = await pool.query(
      `INSERT INTO employers (name, industry, website, description, contact_name, contact_email, contact_phone, address)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [name, industry || null, website || null, description || null,
       contact_name || null, contact_email || null, contact_phone || null, address || null]
    );

    pool.query(
      `INSERT INTO activity_log (entity_type, entity_id, action, performed_by, metadata)
       VALUES ('employer', $1, 'created', $2, $3)`,
      [rows[0].id, req.user.id, JSON.stringify({ name })]
    ).catch(() => {});

    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
});

// ── PUT /api/employers/:id ───────────────────────────────
employersRouter.put("/:id", requireRole("admin", "recruiter_admin"), async (req, res, next) => {
  try {
    const { name, industry, website, description, contact_name, contact_email, contact_phone, address, is_active } = req.body;

    const { rows } = await pool.query(
      `UPDATE employers
       SET name          = COALESCE($1,  name),
           industry      = COALESCE($2,  industry),
           website       = COALESCE($3,  website),
           description   = COALESCE($4,  description),
           contact_name  = COALESCE($5,  contact_name),
           contact_email = COALESCE($6,  contact_email),
           contact_phone = COALESCE($7,  contact_phone),
           address       = COALESCE($8,  address),
           is_active     = COALESCE($9,  is_active),
           updated_at    = NOW()
       WHERE id = $10 RETURNING *`,
      [name, industry, website, description, contact_name, contact_email, contact_phone, address, is_active, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ success: false, error: "Employer not found" });

    pool.query(
      `INSERT INTO activity_log (entity_type, entity_id, action, performed_by)
       VALUES ('employer', $1, 'updated', $2)`,
      [req.params.id, req.user.id]
    ).catch(() => {});

    res.json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
});

// ── DELETE /api/employers/:id (soft delete) ──────────────
employersRouter.delete("/:id", requireRole("admin"), async (req, res, next) => {
  try {
    const { rows: openJobs } = await pool.query(
      `SELECT COUNT(*)::int AS cnt FROM jobs WHERE employer_id = $1 AND status = 'open'`,
      [req.params.id]
    );
    if (openJobs[0].cnt > 0) {
      return res.status(409).json({ success: false, error: "Employer has open jobs. Close them before deactivating." });
    }

    const { rows } = await pool.query(
      `UPDATE employers SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING id`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ success: false, error: "Employer not found" });

    pool.query(
      `INSERT INTO activity_log (entity_type, entity_id, action, performed_by)
       VALUES ('employer', $1, 'deactivated', $2)`,
      [req.params.id, req.user.id]
    ).catch(() => {});

    res.json({ success: true });
  } catch (err) { next(err); }
});
