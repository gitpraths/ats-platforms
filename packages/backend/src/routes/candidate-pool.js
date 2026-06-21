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
    const {
      tab = "all",
      page: rawPage = 1,
      limit: rawLimit = 20,
      q = "",
      date_from      = "",
      name_q         = "",
      email_q        = "",
      phone_q        = "",
      provider_q     = "",
      comments_q     = "",
      referral_date  = "",
      training_date  = "",
      interview_date = "",
      ets_date       = "",
      placement_date = "",
    } = req.query;

    const page   = Math.max(1, Number(rawPage));
    const limit  = Math.min(100, Math.max(1, Number(rawLimit)));
    const offset = (page - 1) * limit;

    // ── Build dynamic WHERE conditions ───────────────────────
    const params = [];
    let idx = 1;
    const conditions = [];

    // Legacy global search
    if (q) {
      conditions.push(
        `(c.name ILIKE $${idx} OR c.email ILIKE $${idx} OR c.phone ILIKE $${idx} OR pr.name ILIKE $${idx})`
      );
      params.push(`%${q}%`); idx++;
    }

    // Referral date range (All Time / This Week / This Month pills)
    if (date_from) { conditions.push(`c.date_referred >= $${idx++}`); params.push(date_from); }

    // Text column filters
    if (name_q)     { conditions.push(`c.name ILIKE $${idx++}`);                        params.push(`%${name_q}%`); }
    if (email_q)    { conditions.push(`c.email ILIKE $${idx++}`);                       params.push(`%${email_q}%`); }
    if (phone_q)    { conditions.push(`c.phone ILIKE $${idx++}`);                       params.push(`%${phone_q}%`); }
    if (provider_q) { conditions.push(`pr.name ILIKE $${idx++}`);                      params.push(`%${provider_q}%`); }
    if (comments_q) { conditions.push(`COALESCE(c.comments, c.notes) ILIKE $${idx++}`); params.push(`%${comments_q}%`); }

    // Date column filters (exact date match)
    if (referral_date)  { conditions.push(`c.date_referred = $${idx++}`);       params.push(referral_date); }
    if (training_date)  { conditions.push(`c.training_start_date = $${idx++}`); params.push(training_date); }
    if (interview_date) { conditions.push(`la.interview_date = $${idx++}`);     params.push(interview_date); }
    if (ets_date)       { conditions.push(`la.ets_date = $${idx++}`);           params.push(ets_date); }
    if (placement_date) { conditions.push(`la.placement_date = $${idx++}`);     params.push(placement_date); }

    const colWhere = conditions.length > 0 ? `AND ${conditions.join(" AND ")}` : "";

    // Shared lateral joins used in both data + total count queries
    const lateralJoins = `
       LEFT JOIN providers pr    ON pr.id = c.provider_id
       LEFT JOIN consultants con ON con.id = c.consultant_id
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
         SELECT id, stage, interview_date, ets_date, placement_date
         FROM applications
         WHERE candidate_id = c.id
         ORDER BY updated_at DESC
         LIMIT 1
       ) la ON true`;

    // ── Main data query ─────────────────────────────────
    const { rows } = await pool.query(
      `SELECT
         c.id, c.name, c.email, c.phone,
         c.sr_no,
         c.city, c.state, c.suburb, c.date_referred,
         c.work_status,
         c.car, c.police_check, c.wwc,
         COALESCE(c.comments, c.notes) AS comments,
         c.benchmark_hours,
         c.wage_subsidy,
         c.industry_preference,
         c.training_start_date, c.training_end_date,
         pr.name         AS provider_name,
         pr.contact_name AS provider_contact_name,
         pr.email        AS provider_contact_email,
         con.name        AS consultant_name,
         lp.id           AS placement_id,
         lp.start_date   AS job_start_date,
         lp.confirmed_by_employer,
         e.name          AS employer_name,
         j.title         AS job_title,
         la.stage          AS latest_stage,
         la.id             AS latest_application_id,
         la.interview_date AS latest_interview_date,
         la.ets_date       AS latest_ets_date,
         la.placement_date AS latest_placement_date
       FROM candidates c
       ${lateralJoins}
       WHERE ${tabCondition(tab)} ${colWhere}
       ORDER BY COALESCE(c.date_referred, c.created_at::date) DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset]
    );

    // ── Welfare checks for placed candidates ────────────────
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

    // ── Total count (respects all column filters, for pagination) ─
    const { rows: totalRows } = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM candidates c
       ${lateralJoins}
       WHERE ${tabCondition(tab)} ${colWhere}`,
      params
    );
    const total = totalRows[0].total;

    // ── Tab counts (unfiltered — always show overall tab totals) ──
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
       FROM candidates c`
    );

    const tabCounts = {
      all:            countRows[0].all_count,
      in_progress:    countRows[0].in_progress_count,
      placed:         countRows[0].placed_count,
      not_successful: countRows[0].not_successful_count,
      inactive:       countRows[0].inactive_count,
    };

    res.json({
      success: true,
      data,
      meta: { total, page, limit, tab_counts: tabCounts },
    });
  } catch (err) { next(err); }
});
