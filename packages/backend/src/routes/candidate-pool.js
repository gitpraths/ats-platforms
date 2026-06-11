import { Router } from "express";
import { pool } from "../config/db.js";
import { requireAuth } from "../middleware/auth.js";

export const candidatePoolRouter = Router();
candidatePoolRouter.use(requireAuth);

function tabCondition(tab) {
  switch (tab) {
    case "in_progress":
      return `EXISTS (
        SELECT 1 FROM applications a
        WHERE a.candidate_id = c.id
          AND a.stage IN ('applied','screening','interview','offer')
      )`;
    case "placed":
      return `c.work_status = 'placed'`;
    case "not_successful":
      return `NOT EXISTS (
          SELECT 1 FROM applications a
          WHERE a.candidate_id = c.id
            AND a.stage IN ('applied','screening','interview','offer')
        )
        AND EXISTS (
          SELECT 1 FROM applications a2
          WHERE a2.candidate_id = c.id AND a2.stage = 'rejected'
        )
        AND c.work_status NOT IN ('placed','inactive')`;
    case "inactive":
      return `c.work_status = 'inactive'`;
    default:
      return "1=1";
  }
}

// GET /api/candidate-pool
candidatePoolRouter.get("/", async (req, res, next) => {
  try {
    const { tab = "all", page: rawPage = 1, limit: rawLimit = 20, q = "" } = req.query;
    const page = Math.max(1, Number(rawPage));
    const limit = Math.min(100, Math.max(1, Number(rawLimit)));
    const offset = (page - 1) * limit;

    const params = [];
    let idx = 1;

    const searchCondition = q
      ? `AND (c.name ILIKE $${idx} OR c.email ILIKE $${idx} OR c.phone ILIKE $${idx})`
      : "";
    if (q) { params.push(`%${q}%`); idx++; }

    const { rows } = await pool.query(
      `SELECT
         c.id, c.name, c.email, c.phone,
         c.city, c.state,
         c.work_status, c.notes,
         c.training_start_date, c.training_end_date,
         pr.name         AS provider_name,
         pr.contact_name AS provider_contact_name,
         pr.email        AS provider_contact_email,
         lp.id           AS placement_id,
         lp.start_date   AS job_start_date,
         lp.confirmed_by_employer,
         e.name          AS employer_name,
         j.title         AS job_title,
         la.stage        AS latest_stage,
         la.id           AS latest_application_id
       FROM candidates c
       LEFT JOIN providers pr ON pr.id = c.provider_id
       LEFT JOIN LATERAL (
         SELECT id, job_id, employer_id, start_date, confirmed_by_employer
         FROM placements
         WHERE candidate_id = c.id
         ORDER BY created_at DESC
         LIMIT 1
       ) lp ON true
       LEFT JOIN employers e ON e.id = lp.employer_id
       LEFT JOIN jobs j ON j.id = lp.job_id
       LEFT JOIN LATERAL (
         SELECT id, stage
         FROM applications
         WHERE candidate_id = c.id
         ORDER BY updated_at DESC
         LIMIT 1
       ) la ON true
       WHERE ${tabCondition(tab)} ${searchCondition}
       ORDER BY c.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset]
    );

    // Attach welfare checks for placed candidates
    const placementIds = rows.map((r) => r.placement_id).filter(Boolean);
    const wcMap = {};
    if (placementIds.length) {
      const { rows: wcs } = await pool.query(
        `SELECT placement_id, check_type, due_date, completed_at, email_sent_at
         FROM welfare_checks WHERE placement_id = ANY($1)`,
        [placementIds]
      );
      for (const wc of wcs) {
        if (!wcMap[wc.placement_id]) wcMap[wc.placement_id] = [];
        wcMap[wc.placement_id].push(wc);
      }
    }

    const data = rows.map((r) => ({
      ...r,
      welfare_checks: r.placement_id ? (wcMap[r.placement_id] || []) : [],
    }));

    // Tab counts (always against full dataset, search applied)
    const countParams = q ? [`%${q}%`] : [];
    const countSearch = q
      ? `WHERE (c.name ILIKE $1 OR c.email ILIKE $1 OR c.phone ILIKE $1)`
      : "";

    const { rows: countRows } = await pool.query(
      `SELECT
         COUNT(*)::int AS all_count,
         COUNT(*) FILTER (WHERE EXISTS (
           SELECT 1 FROM applications a
           WHERE a.candidate_id = c.id
             AND a.stage IN ('applied','screening','interview','offer')
         ))::int AS in_progress_count,
         COUNT(*) FILTER (WHERE c.work_status = 'placed')::int AS placed_count,
         COUNT(*) FILTER (WHERE
           NOT EXISTS (
             SELECT 1 FROM applications a
             WHERE a.candidate_id = c.id
               AND a.stage IN ('applied','screening','interview','offer')
           )
           AND EXISTS (
             SELECT 1 FROM applications a2
             WHERE a2.candidate_id = c.id AND a2.stage = 'rejected'
           )
           AND c.work_status NOT IN ('placed','inactive')
         )::int AS not_successful_count,
         COUNT(*) FILTER (WHERE c.work_status = 'inactive')::int AS inactive_count
       FROM candidates c
       ${countSearch}`,
      countParams
    );

    const tabCounts = {
      all:            countRows[0].all_count,
      in_progress:    countRows[0].in_progress_count,
      placed:         countRows[0].placed_count,
      not_successful: countRows[0].not_successful_count,
      inactive:       countRows[0].inactive_count,
    };

    const totalForTab = tabCounts[tab] ?? tabCounts.all;

    res.json({
      success: true,
      data,
      meta: {
        total: totalForTab,
        page,
        limit,
        tab_counts: tabCounts,
      },
    });
  } catch (err) { next(err); }
});
