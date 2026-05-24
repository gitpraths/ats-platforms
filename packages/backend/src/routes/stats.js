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
           COUNT(*) FILTER (WHERE a.stage = 'offer')      AS offer_count,
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
