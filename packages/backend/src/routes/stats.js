import { Router } from "express";
import { pool } from "../config/db.js";
import { requireAuth } from "../middleware/auth.js";

export const statsRouter = Router();
statsRouter.use(requireAuth);

// GET /api/stats
statsRouter.get("/", async (req, res, next) => {
  try {
    const userId  = req.user.id;
    const isAdmin = ["admin", "recruiter_admin"].includes(req.user.role);

    // Applications scope: admins see all, others see only their jobs
    const appScopeWhere = isAdmin
      ? ""
      : `WHERE j.created_by = $1
           OR EXISTS (SELECT 1 FROM job_recruiter jr WHERE jr.job_id = j.id AND jr.user_id = $1)`;

    const appParams = isAdmin ? [] : [userId];

    const staffParams = isAdmin ? [] : [userId];
    const staffScope  = isAdmin ? "" : "AND u.id = $1";

    const [jobs, apps, candidates, placements, providers, employers, staffPlacements] = await Promise.all([
      pool.query(
        `SELECT
           COUNT(*)                                               AS total_jobs,
           COUNT(*) FILTER (WHERE status = 'draft')              AS draft_jobs,
           COUNT(*) FILTER (WHERE status = 'open'
                              OR status = 'published')           AS published_jobs,
           COUNT(*) FILTER (WHERE status = 'archived')           AS archived_jobs
         FROM jobs`
      ),
      pool.query(
        `SELECT
           COUNT(*)                                                           AS total_applications,
           COUNT(*) FILTER (WHERE a.stage NOT IN ('hired','rejected'))        AS active_applications,
           COUNT(*) FILTER (WHERE a.stage = 'hired'
             AND DATE_TRUNC('month', a.updated_at) = DATE_TRUNC('month', NOW())) AS hired_this_month,
           COUNT(*) FILTER (WHERE a.stage = 'applied')    AS applied_count,
           COUNT(*) FILTER (WHERE a.stage = 'screening')  AS screening_count,
           COUNT(*) FILTER (WHERE a.stage = 'interview')  AS interview_count,
           COUNT(*) FILTER (WHERE a.stage = 'ets')        AS ets_count,
           COUNT(*) FILTER (WHERE a.stage = 'hired')      AS hired_count,
           COUNT(*) FILTER (WHERE a.stage = 'rejected')   AS rejected_count
         FROM applications a
         JOIN jobs j ON a.job_id = j.id
         ${appScopeWhere}`,
        appParams
      ),
      pool.query("SELECT COUNT(*) AS total_candidates FROM candidates"),
      pool.query(
        `SELECT
           COUNT(*)                                                        AS total_placements,
           COUNT(*) FILTER (WHERE confirmed_by_employer = true)           AS confirmed_placements,
           COUNT(*) FILTER (WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW())) AS placements_this_month
         FROM placements`
      ),
      pool.query(
        `SELECT
           COUNT(*)                                          AS total_providers,
           COUNT(*) FILTER (WHERE is_active = true)         AS active_providers
         FROM providers`
      ),
      pool.query(
        `SELECT
           COUNT(*)                                          AS total_employers,
           COUNT(*) FILTER (WHERE is_active = true)         AS active_employers
         FROM employers`
      ),
      pool.query(
        `SELECT
           u.id          AS user_id,
           u.name,
           COUNT(p.id)::int AS total_placements,
           COUNT(p.id) FILTER (
             WHERE DATE_TRUNC('month', p.created_at) = DATE_TRUNC('month', NOW())
           )::int AS placements_this_month
         FROM users u
         LEFT JOIN placements p ON p.created_by = u.id
         WHERE u.role IN ('admin', 'recruiter_admin', 'recruiter')
           ${staffScope}
         GROUP BY u.id, u.name
         ORDER BY total_placements DESC, u.name ASC`,
        staffParams
      ),
    ]);

    // Welfare checks due today or overdue (not yet completed)
    const { rows: overdueRows } = await pool.query(
      `SELECT COUNT(*)::int AS overdue_checks
       FROM welfare_checks
       WHERE due_date <= CURRENT_DATE
         AND completed_at IS NULL`
    );

    res.json({
      success: true,
      data: {
        jobs: {
          total:     Number(jobs.rows[0].total_jobs),
          draft:     Number(jobs.rows[0].draft_jobs),
          published: Number(jobs.rows[0].published_jobs),
          archived:  Number(jobs.rows[0].archived_jobs),
        },
        applications: {
          total:            Number(apps.rows[0].total_applications),
          active:           Number(apps.rows[0].active_applications),
          hired_this_month: Number(apps.rows[0].hired_this_month),
          by_stage: {
            applied:   Number(apps.rows[0].applied_count),
            screening: Number(apps.rows[0].screening_count),
            interview: Number(apps.rows[0].interview_count),
            offer:     Number(apps.rows[0].offer_count),
            hired:     Number(apps.rows[0].hired_count),
            rejected:  Number(apps.rows[0].rejected_count),
          },
        },
        candidates: {
          total: Number(candidates.rows[0].total_candidates),
        },
        placements: {
          total:              Number(placements.rows[0].total_placements),
          confirmed:          Number(placements.rows[0].confirmed_placements),
          this_month:         Number(placements.rows[0].placements_this_month),
          overdue_welfare:    overdueRows[0].overdue_checks,
        },
        providers: {
          total:  Number(providers.rows[0].total_providers),
          active: Number(providers.rows[0].active_providers),
        },
        employers: {
          total:  Number(employers.rows[0].total_employers),
          active: Number(employers.rows[0].active_employers),
        },
        placements_by_staff: staffPlacements.rows.map((r) => ({
          user_id:               r.user_id,
          name:                  r.name,
          total_placements:      r.total_placements,
          placements_this_month: r.placements_this_month,
        })),
      },
    });
  } catch (err) { next(err); }
});

// ── Helper: pivot raw rows into Recharts-ready month objects ─────────────────
// rawRows: [{ month: 'Jan 2026', group_key: 'Provider A', count: 3 }, ...]
// Returns: [{ month: 'Jan 2026', 'Provider A': 3, ... }, ...]
function pivotToMonths(rawRows, last6Months) {
  const map = {};
  for (const m of last6Months) map[m] = { month: m };
  for (const row of rawRows) {
    if (!map[row.month]) map[row.month] = { month: row.month };
    map[row.month][row.group_key] = row.count;
  }
  return last6Months.map((m) => map[m]);
}

// Build the ordered list of last 6 month labels (oldest first)
// Use hardcoded abbreviations to exactly match Postgres TO_CHAR(..., 'Mon YYYY')
function last6MonthLabels() {
  const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const labels = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    labels.push(`${MON[d.getMonth()]} ${d.getFullYear()}`);
  }
  return labels;
}

// GET /api/stats/training-by-type
// Trainings grouped by training name, last 6 months (uses created_at so all statuses are included)
statsRouter.get("/training-by-type", async (_req, res, next) => {
  try {
    const months = last6MonthLabels();
    const { rows } = await pool.query(`
      SELECT
        TO_CHAR(DATE_TRUNC('month', ct.created_at), 'Mon YYYY') AS month,
        t.name                                                    AS group_key,
        COUNT(ct.id)::int                                         AS count
      FROM candidate_trainings ct
      JOIN trainings t ON t.id = ct.training_id
      WHERE ct.created_at >= DATE_TRUNC('month', NOW()) - INTERVAL '5 months'
        AND ct.created_at <  DATE_TRUNC('month', NOW()) + INTERVAL '1 month'
      GROUP BY 1, 2
      ORDER BY DATE_TRUNC('month', ct.created_at), t.name
    `);
    res.json({ success: true, data: pivotToMonths(rows, months) });
  } catch (err) { next(err); }
});

// GET /api/stats/candidates-by-provider
// Candidates registered/referred grouped by provider name, last 6 months
statsRouter.get("/candidates-by-provider", async (_req, res, next) => {
  try {
    const months = last6MonthLabels();
    const { rows } = await pool.query(`
      SELECT
        TO_CHAR(DATE_TRUNC('month', c.created_at), 'Mon YYYY') AS month,
        COALESCE(p.name, 'No Provider')                         AS group_key,
        COUNT(c.id)::int                                         AS count
      FROM candidates c
      LEFT JOIN providers p ON p.id = c.provider_id
      WHERE c.created_at >= DATE_TRUNC('month', NOW()) - INTERVAL '5 months'
        AND c.created_at <  DATE_TRUNC('month', NOW()) + INTERVAL '1 month'
      GROUP BY 1, 2
      ORDER BY DATE_TRUNC('month', c.created_at), group_key
    `);
    res.json({ success: true, data: pivotToMonths(rows, months) });
  } catch (err) { next(err); }
});

// GET /api/stats/placements-by-provider
// Placements grouped by provider name, last 6 months
statsRouter.get("/placements-by-provider", async (_req, res, next) => {
  try {
    const months = last6MonthLabels();
    const { rows } = await pool.query(`
      SELECT
        TO_CHAR(DATE_TRUNC('month', pl.created_at), 'Mon YYYY') AS month,
        COALESCE(pr.name, 'No Provider')                         AS group_key,
        COUNT(pl.id)::int                                         AS count
      FROM placements pl
      JOIN candidates c  ON c.id  = pl.candidate_id
      LEFT JOIN providers pr ON pr.id = c.provider_id
      WHERE pl.created_at >= DATE_TRUNC('month', NOW()) - INTERVAL '5 months'
        AND pl.created_at <  DATE_TRUNC('month', NOW()) + INTERVAL '1 month'
      GROUP BY 1, 2
      ORDER BY DATE_TRUNC('month', pl.created_at), group_key
    `);
    res.json({ success: true, data: pivotToMonths(rows, months) });
  } catch (err) { next(err); }
});

// GET /api/stats/placements-by-staff
// Placements grouped by staff member (KPI), last 6 months
statsRouter.get("/placements-by-staff", async (_req, res, next) => {
  try {
    const months = last6MonthLabels();
    const { rows } = await pool.query(`
      SELECT
        TO_CHAR(DATE_TRUNC('month', pl.created_at), 'Mon YYYY') AS month,
        u.name                                                    AS group_key,
        COUNT(pl.id)::int                                         AS count
      FROM placements pl
      JOIN users u ON u.id = pl.created_by
      WHERE u.role IN ('admin', 'recruiter_admin', 'recruiter')
        AND pl.created_at >= DATE_TRUNC('month', NOW()) - INTERVAL '5 months'
        AND pl.created_at <  DATE_TRUNC('month', NOW()) + INTERVAL '1 month'
      GROUP BY 1, 2
      ORDER BY DATE_TRUNC('month', pl.created_at), u.name
    `);
    res.json({ success: true, data: pivotToMonths(rows, months) });
  } catch (err) { next(err); }
});
