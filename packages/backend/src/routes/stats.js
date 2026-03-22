import { Router } from "express";
import { pool } from "../config/db.js";
import { requireAuth } from "../middleware/auth.js";

export const statsRouter = Router();
statsRouter.use(requireAuth);

// GET /api/stats
// Returns dashboard summary counts scoped to the authenticated user's accessible jobs
statsRouter.get("/", async (req, res, next) => {
  try {
    const userId = req.user.id;

    const [jobs, apps, candidates] = await Promise.all([
      pool.query(
        `SELECT
           COUNT(*)                                               AS total_jobs,
           COUNT(*) FILTER (WHERE status = 'draft')              AS draft_jobs,
           COUNT(*) FILTER (WHERE status = 'published')          AS published_jobs,
           COUNT(*) FILTER (WHERE status = 'archived')           AS archived_jobs
         FROM jobs`
      ),
      pool.query(
        `SELECT
           COUNT(*)                                                           AS total_applications,
           COUNT(*) FILTER (WHERE stage NOT IN ('hired','rejected'))          AS active_applications,
           COUNT(*) FILTER (WHERE stage = 'hired'
             AND DATE_TRUNC('month', updated_at) = DATE_TRUNC('month', NOW())) AS hired_this_month,
           COUNT(*) FILTER (WHERE stage = 'applied')    AS applied_count,
           COUNT(*) FILTER (WHERE stage = 'screening')  AS screening_count,
           COUNT(*) FILTER (WHERE stage = 'interview')  AS interview_count,
           COUNT(*) FILTER (WHERE stage = 'offer')      AS offer_count,
           COUNT(*) FILTER (WHERE stage = 'hired')      AS hired_count,
           COUNT(*) FILTER (WHERE stage = 'rejected')   AS rejected_count
         FROM applications a
         JOIN jobs j ON a.job_id = j.id
         WHERE j.created_by = $1
            OR EXISTS (SELECT 1 FROM job_recruiter jr WHERE jr.job_id = j.id AND jr.user_id = $1)`,
        [userId]
      ),
      pool.query("SELECT COUNT(*) AS total_candidates FROM candidates"),
    ]);

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
          total:          Number(apps.rows[0].total_applications),
          active:         Number(apps.rows[0].active_applications),
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
      },
    });
  } catch (err) { next(err); }
});
