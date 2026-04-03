import { Router } from "express";
import { pool } from "../config/db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const reportsRouter = Router();
reportsRouter.use(requireAuth);
reportsRouter.use(requireRole("admin", "recruiter_admin"));

// ── GET /api/reports/providers ───────────────────────────
reportsRouter.get("/providers", async (req, res, next) => {
  try {
    const { from, to, page = 1, limit = 50 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const params = [];
    let idx = 1;
    const dateFilter = [];

    if (from) { dateFilter.push(`c.created_at >= $${idx}`); params.push(from); idx++; }
    if (to)   { dateFilter.push(`c.created_at <= $${idx}`); params.push(to);   idx++; }

    const where = dateFilter.length ? `WHERE ${dateFilter.join(" AND ")}` : "";

    const { rows } = await pool.query(
      `SELECT
         pr.id AS provider_id,
         pr.name AS provider_name,
         COUNT(c.id)::int AS total_candidates,
         COUNT(c.id) FILTER (WHERE c.work_status != 'inactive')::int AS active_candidates,
         COUNT(c.id) FILTER (WHERE c.work_status = 'placed')::int AS placed_candidates,
         COUNT(c.id) FILTER (WHERE c.work_status = 'job_seeking')::int AS job_seeking_candidates,
         COUNT(c.id) FILTER (WHERE c.work_status = 'inactive')::int AS inactive_candidates
       FROM providers pr
       LEFT JOIN candidates c ON c.provider_id = pr.id
       ${where}
       GROUP BY pr.id, pr.name
       ORDER BY pr.name
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, Number(limit), offset]
    );

    const data = rows.map((r) => ({
      ...r,
      placement_rate: r.total_candidates > 0
        ? `${Math.round((r.placed_candidates / r.total_candidates) * 100)}%`
        : "0%",
    }));

    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// ── GET /api/reports/placements ──────────────────────────
reportsRouter.get("/placements", async (req, res, next) => {
  try {
    const { from, to, employer_id, provider_id, page = 1, limit = 50 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const conditions = [];
    const params = [];
    let idx = 1;

    if (from)        { conditions.push(`p.start_date >= $${idx}`);      params.push(from);        idx++; }
    if (to)          { conditions.push(`p.start_date <= $${idx}`);      params.push(to);          idx++; }
    if (employer_id) { conditions.push(`p.employer_id = $${idx}`);      params.push(employer_id); idx++; }
    if (provider_id) { conditions.push(`c.provider_id = $${idx}`);      params.push(provider_id); idx++; }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const { rows } = await pool.query(
      `SELECT
         p.id AS placement_id,
         c.name AS candidate_name,
         j.title AS job_title,
         e.name AS employer_name,
         pr.name AS provider_name,
         p.start_date,
         p.confirmed_by_employer
       FROM placements p
       JOIN candidates c  ON c.id = p.candidate_id
       JOIN jobs j        ON j.id = p.job_id
       LEFT JOIN employers e  ON e.id = p.employer_id
       LEFT JOIN providers pr ON pr.id = c.provider_id
       ${where}
       ORDER BY p.start_date DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, Number(limit), offset]
    );

    // Attach welfare checks
    const ids = rows.map((r) => r.placement_id);
    let wcMap = {};
    if (ids.length) {
      const { rows: wcs } = await pool.query(
        `SELECT placement_id, check_type, due_date, completed_at
         FROM welfare_checks WHERE placement_id = ANY($1)`,
        [ids]
      );
      for (const wc of wcs) {
        if (!wcMap[wc.placement_id]) wcMap[wc.placement_id] = {};
        wcMap[wc.placement_id][wc.check_type] = {
          due_date: wc.due_date,
          completed: !!wc.completed_at,
        };
      }
    }

    const data = rows.map((r) => ({
      ...r,
      welfare_checks: wcMap[r.placement_id] || {},
    }));

    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// ── GET /api/reports/staff ───────────────────────────────
reportsRouter.get("/staff", async (req, res, next) => {
  try {
    const { from, to, page = 1, limit = 50 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const conditions = ["u.role IN ('admin','recruiter_admin','recruiter')"];
    const params = [];
    let idx = 1;

    if (from) { conditions.push(`j.created_at >= $${idx}`); params.push(from); idx++; }
    if (to)   { conditions.push(`j.created_at <= $${idx}`); params.push(to);   idx++; }

    const where = `WHERE ${conditions.join(" AND ")}`;

    const { rows } = await pool.query(
      `SELECT
         u.id AS user_id,
         u.name AS user_name,
         u.role,
         COUNT(DISTINCT jr.job_id)::int AS jobs_assigned,
         COUNT(DISTINCT jr.job_id) FILTER (WHERE j.status = 'open')::int AS active_jobs,
         COUNT(DISTINCT a.id)::int AS total_applications,
         COUNT(DISTINCT p.id)::int AS total_placements
       FROM users u
       LEFT JOIN job_recruiter jr ON jr.user_id = u.id
       LEFT JOIN jobs j           ON j.id = jr.job_id
       LEFT JOIN applications a   ON a.job_id = j.id
       LEFT JOIN placements p     ON p.job_id = j.id
       ${where}
       GROUP BY u.id, u.name, u.role
       ORDER BY u.name
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, Number(limit), offset]
    );

    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});
