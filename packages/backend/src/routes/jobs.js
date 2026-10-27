import { Router } from "express";
import { pool } from "../config/db.js";
import { requireAuth, requireRole, requirePermission } from "../middleware/auth.js";
import { validateJobStatusTransition, toTitleCase } from "../utils/index.js";
import { sendVacancyBroadcast, sendMultiVacancyBroadcast, sendEmail } from "../services/email.js";

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
jobsRouter.get("/", requirePermission("jobs:view"), async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, department_id, location_id, job_type, work_model, team, title } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const params = [];
    const conditions = [];

    if (status) {
      if (status === "open") {
        conditions.push(`j.status IN ('published', 'draft')`);
      } else if (status === "active") {
        conditions.push(`j.status != 'archived'`);
      } else if (status.includes(",")) {
        const statuses = status.split(",").map(s => s.trim());
        params.push(statuses);
        conditions.push(`j.status = ANY($${params.length})`);
      } else {
        params.push(status);
        conditions.push(`j.status = $${params.length}`);
      }
    }
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
              u_src.name AS sourced_by_name,
              COUNT(DISTINCT a.id)::int AS application_count
       FROM jobs j
       LEFT JOIN departments d  ON j.department_id = d.id
       LEFT JOIN locations   l  ON j.location_id   = l.id
       LEFT JOIN users       u  ON j.created_by    = u.id
       LEFT JOIN users   u_src  ON j.sourced_by_user_id = u_src.id
       LEFT JOIN applications a ON a.job_id        = j.id
       ${where}
       GROUP BY j.id, d.name, l.city, l.state, l.country, l.is_remote, u.name, u_src.name
       ORDER BY j.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    const countParams = params.slice(0, params.length - 2); // remove limit and offset
    const { rows: [{ total }] } = await pool.query(
      `SELECT COUNT(*)::int AS total 
       FROM jobs j
       ${where}`,
      countParams
    );

    // Attach recruiters to each job
    const jobs = await Promise.all(
      rows.map(async (job) => ({ ...job, recruiters: await getRecruiters(job.id) }))
    );

    res.json({ success: true, data: jobs, meta: { total, page: Number(page), limit: Number(limit) } });
  } catch (err) { next(err); }
});

// ── GET /api/jobs/:id ─────────────────────────────────────────────────────────
jobsRouter.get("/:id", requirePermission("jobs:view"), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT j.*,
              d.name AS department_name,
              l.city, l.state, l.country, l.is_remote,
              u.name AS created_by_name,
              u_src.name AS sourced_by_name
       FROM jobs j
       LEFT JOIN departments d ON j.department_id = d.id
       LEFT JOIN locations   l ON j.location_id   = l.id
       LEFT JOIN users       u ON j.created_by    = u.id
       LEFT JOIN users   u_src ON j.sourced_by_user_id = u_src.id
       WHERE j.id = $1`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ success: false, error: "Job not found" });

    const job = { ...rows[0], recruiters: await getRecruiters(req.params.id) };
    res.json({ success: true, data: job });
  } catch (err) { next(err); }
});

// ── POST /api/jobs ────────────────────────────────────────────────────────────
jobsRouter.post("/", requirePermission("jobs:create"), async (req, res, next) => {
  try {
    const {
      title, description,
      employer_id, industry, pay_rate, pay_rate_type,
      positions_count, vacancy_type, work_location, job_board_url,
      police_check, drug_alcohol_test, wwc, car_required, public_transport,
      wage_subsidy_required, comments, status, sourced_by_user_id,
      sourced_by_type, sourced_by_custom_name,
      // legacy fields kept for backward compatibility
      department_id, location_id, skills_required, skills_desired,
      job_type, work_model, cover_letter_required, min_annual_salary,
      max_annual_salary, currency_code, experience_years_min, deadline,
      team, staff_working_status, end_date,
    } = req.body;

    if (!title) return res.status(400).json({ success: false, error: "title is required" });
    const cleanTitle = toTitleCase(title.trim());

    const { rows } = await pool.query(
      `INSERT INTO jobs (
         title, description, employer_id,
         industry, pay_rate, pay_rate_type,
         positions_count, vacancy_type, work_location, job_board_url,
         police_check, drug_alcohol_test, wwc, car_required, public_transport,
         wage_subsidy_required, comments, sourced_by_user_id,
         sourced_by_type, sourced_by_custom_name,
         department_id, location_id, skills_required, skills_desired,
         job_type, work_model, cover_letter_required, min_annual_salary,
         max_annual_salary, currency_code, experience_years_min, deadline,
         team, staff_working_status, end_date,
         status, created_by, updated_by
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
         $21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,
         $36,$37,$37
       ) RETURNING id, job_number, created_at`,
      [
        cleanTitle, description || null, employer_id || null,
        industry || null, pay_rate !== undefined && pay_rate !== null && pay_rate !== "" ? String(pay_rate).trim() : null, pay_rate_type || 'per_hour',
        positions_count || 1, vacancy_type || null, work_location || null, job_board_url || null,
        police_check || 'not_required', drug_alcohol_test || 'no', wwc || 'no',
        car_required || 'no', public_transport || 'no',
        wage_subsidy_required || 'no', comments || null, sourced_by_user_id || req.user.id,
        sourced_by_type || 'staff', sourced_by_custom_name || null,
        department_id || null, location_id || null,
        skills_required || [], skills_desired || [],
        job_type || 'full_time', work_model || 'onsite',
        cover_letter_required ?? false,
        min_annual_salary || null, max_annual_salary || null, currency_code || 'AUD',
        experience_years_min || null, deadline || null, team || null,
        staff_working_status || 'active', end_date || null,
        status || 'draft', req.user.id,
      ]
    );
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
});

// ── PATCH /api/jobs/:id ───────────────────────────────────────────────────────
jobsRouter.patch("/:id", requirePermission("jobs:edit"), async (req, res, next) => {
  try {
    const allowed = [
      "title", "description", "department_id", "location_id",
      "skills_required", "skills_desired", "job_type", "work_model",
      "cover_letter_required", "min_annual_salary", "max_annual_salary", "currency_code",
      "experience_years_min", "deadline", "team", "status",
      "employer_id", "positions_count", "job_board_url", "vacancy_type", "staff_working_status", "end_date",
      // new vacancy form fields
      "industry", "pay_rate", "pay_rate_type", "work_location",
      "police_check", "drug_alcohol_test", "wwc", "car_required",
      "public_transport", "wage_subsidy_required", "comments", "sourced_by_user_id",
      "sourced_by_type", "sourced_by_custom_name",
    ];

    const updates = [];
    const params  = [];

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        let val = req.body[key];
        if (key === "title" && typeof val === "string") {
          val = toTitleCase(val.trim());
        } else if (key === "pay_rate") {
          val = val !== null && val !== "" ? String(val).trim() : null;
        }
        params.push(val);
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

    let oldStatus = null;
    if (req.body.status) {
      const currentRes = await pool.query("SELECT status FROM jobs WHERE id = $1", [req.params.id]);
      if (currentRes.rows[0]) {
        oldStatus = currentRes.rows[0].status === "open" ? "published" : currentRes.rows[0].status;
      }
    }

    params.push(req.user.id, req.params.id);
    const { rows } = await pool.query(
      `UPDATE jobs SET ${updates.join(", ")}, updated_at = NOW(), updated_by = $${params.length - 1}
       WHERE id = $${params.length} RETURNING *`,
      params
    );
    if (!rows[0]) return res.status(404).json({ success: false, error: "Job not found" });

    // If status was explicitly changed to a DIFFERENT status via vacancy edit, log to job_activity
    if (req.body.status && oldStatus) {
      const targetStatus = req.body.status === "open" ? "published" : req.body.status;
      if (targetStatus !== oldStatus) {
        await pool.query(
          `INSERT INTO job_activity (job_id, user_id, job_status, comment)
           VALUES ($1, $2, $3, $4)`,
          [
            req.params.id,
            req.user.id,
            targetStatus,
            req.body.status_comment || (targetStatus === "published" ? "Published via vacancy edit" : targetStatus === "draft" ? "Reverted to draft via vacancy edit" : `Status changed to ${targetStatus}`)
          ]
        ).catch(() => {});
      }
    }

    const job = { ...rows[0], recruiters: await getRecruiters(req.params.id) };
    res.json({ success: true, data: job });
  } catch (err) { next(err); }
});

// ── PATCH /api/jobs/:id/status ────────────────────────────────────────────────
jobsRouter.patch("/:id/status", async (req, res, next) => {
  try {
    let { job_status, comment } = req.body;
    if (!job_status) return res.status(400).json({ success: false, error: "job_status is required" });
    if (job_status === "open") job_status = "published";
    if (!VALID_STATUSES.includes(job_status))
      return res.status(400).json({ success: false, error: `job_status must be one of: ${VALID_STATUSES.join(", ")}` });

    const jobCheck = await pool.query("SELECT id, status FROM jobs WHERE id = $1", [req.params.id]);
    if (!jobCheck.rows[0]) return res.status(404).json({ success: false, error: "Job not found" });

    const currentNorm = jobCheck.rows[0].status === "open" ? "published" : jobCheck.rows[0].status;
    if (currentNorm === job_status) {
      return res.json({ success: true, data: { job_status, created_at: new Date().toISOString() } });
    }

    validateJobStatusTransition(jobCheck.rows[0].status, job_status);

    await pool.query("UPDATE jobs SET status = $1, updated_at = NOW(), updated_by = $3 WHERE id = $2", [job_status, req.params.id, req.user.id]);

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

    // Validate all user_ids are valid platform users
    const { rows: validUsers } = await pool.query(
      `SELECT id FROM users WHERE id = ANY($1::uuid[])`,
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
jobsRouter.delete("/:id", requirePermission("jobs:delete"), async (req, res, next) => {
  try {
    const { rows: jobRows } = await pool.query("SELECT created_by FROM jobs WHERE id = $1", [req.params.id]);
    if (!jobRows[0]) return res.status(404).json({ success: false, error: "Job not found" });

    const { rows } = await pool.query("DELETE FROM jobs WHERE id = $1 RETURNING id", [req.params.id]);
    res.json({ success: true, data: { id: rows[0].id, status: "DELETED" } });
  } catch (err) { next(err); }
});



// ── POST /api/jobs/:id/broadcast ──────────────────────────────────────────────
// Broadcasts the vacancy to selected training providers and optional custom/test emails.
// Responds immediately — emails are sent in the background.
// Body: { provider_ids?: string[], custom_subject?: string, custom_message?: string, custom_body?: string, additional_emails?: string[] }
jobsRouter.post("/:id/broadcast", async (req, res, next) => {
  try {
    const { provider_ids = [], custom_subject, custom_message, custom_body, additional_emails = [] } = req.body;

    // Fetch full job details with employer + location
    const { rows: jobRows } = await pool.query(
      `SELECT j.*,
              e.name  AS employer_name,
              l.city, l.state, l.country, l.is_remote
       FROM jobs j
       LEFT JOIN employers  e ON e.id = j.employer_id
       LEFT JOIN locations  l ON l.id = j.location_id
       WHERE j.id = $1`,
      [req.params.id]
    );
    if (!jobRows[0]) return res.status(404).json({ success: false, error: "Job not found" });

    const recipients = [];

    // Fetch selected active providers (only those with an email address)
    if (Array.isArray(provider_ids) && provider_ids.length > 0) {
      const { rows: providers } = await pool.query(
        `SELECT id, name, contact_name, email
         FROM providers
         WHERE id = ANY($1::uuid[])
           AND is_active = true
           AND email IS NOT NULL`,
        [provider_ids]
      );
      recipients.push(...providers);
    }

    // Include additional custom / test emails
    if (Array.isArray(additional_emails)) {
      for (const email of additional_emails) {
        const cleaned = String(email).trim();
        if (cleaned && cleaned.includes("@") && !recipients.some(r => r.email.toLowerCase() === cleaned.toLowerCase())) {
          recipients.push({
            id: `custom-${recipients.length}`,
            name: cleaned,
            contact_name: cleaned,
            email: cleaned,
          });
        }
      }
    }

    if (recipients.length === 0) {
      return res.status(400).json({ success: false, error: "No recipients found. Please select providers or enter a recipient email." });
    }

    const jobId      = req.params.id;
    const sentByName = req.user.name || req.user.email;
    const userId     = req.user.id;

    const results = await sendVacancyBroadcast({
      job:           jobRows[0],
      providers:     recipients,
      sentByName,
      appUrl:        process.env.APP_URL,
      customSubject: custom_subject,
      customMessage: custom_message,
      customBody:    custom_body,
    });

    const sentCount = results.filter((r) => r.status === "sent").length;
    const failedCount = results.filter((r) => r.status === "failed").length;

    // Insert into activity_log
    pool.query(
      `INSERT INTO activity_log (entity_type, entity_id, action, performed_by, metadata)
       VALUES ('job', $1, 'broadcast_to_providers', $2, $3)`,
      [
        jobId,
        userId,
        JSON.stringify({
          sent_to:        results.map((r) => ({ id: r.provider_id, name: r.name, email: r.email, status: r.status, error: r.error })),
          sent_count:     sentCount,
          failed_count:   failedCount,
          custom_subject: custom_subject || null,
        }),
      ]
    ).catch(() => {});

    // Also insert into job_activity so it displays in the vacancy's History log
    const recipientNames = results.filter((r) => r.status === "sent").map((r) => r.name || r.email).slice(0, 3).join(", ");
    const moreSuffix = sentCount > 3 ? ` +${sentCount - 3} more` : "";
    const comment = sentCount > 0
      ? `Broadcast sent to ${sentCount} recipient${sentCount !== 1 ? "s" : ""} (${recipientNames}${moreSuffix})`
      : `Broadcast delivery failed for all ${recipients.length} recipients`;

    pool.query(
      `INSERT INTO job_activity (job_id, user_id, job_status, comment)
       VALUES ($1, $2, 'broadcast', $3)`,
      [jobId, userId, comment]
    ).catch(() => {});

    if (sentCount === 0 && recipients.length > 0) {
      const firstError = results.find((r) => r.error)?.error || "Email delivery failed";
      return res.status(502).json({
        success: false,
        error: `Could not deliver broadcast: ${firstError}. Please check SMTP configuration.`,
        data: { sent: 0, failed: failedCount, results },
      });
    }

    res.json({
      success: true,
      data: {
        sent:    sentCount,
        failed:  failedCount,
        results,
        message: `Broadcast successfully sent to ${sentCount} recipient${sentCount !== 1 ? "s" : ""}.${failedCount > 0 ? ` (${failedCount} failed)` : ""}`,
      },
    });
  } catch (err) { next(err); }
});

// ── POST /api/jobs/broadcast-multi ────────────────────────────────────────────
// Broadcasts multiple selected vacancies to training providers and custom emails via one consolidated email digest.
// Body: { job_ids: string[], provider_ids?: string[], custom_subject?: string, custom_message?: string, custom_intro?: string, additional_emails?: string[] }
jobsRouter.post("/broadcast-multi", async (req, res, next) => {
  try {
    const { job_ids, provider_ids = [], custom_subject, custom_message, custom_intro, additional_emails = [] } = req.body;
    if (!Array.isArray(job_ids) || job_ids.length === 0) {
      return res.status(400).json({ success: false, error: "job_ids must be a non-empty array" });
    }

    // Fetch full details for all selected jobs
    const { rows: jobs } = await pool.query(
      `SELECT j.*,
              e.name  AS employer_name,
              l.city, l.state, l.country, l.is_remote
       FROM jobs j
       LEFT JOIN employers  e ON e.id = j.employer_id
       LEFT JOIN locations  l ON l.id = j.location_id
       WHERE j.id = ANY($1::uuid[])
       ORDER BY j.created_at DESC`,
      [job_ids]
    );

    if (jobs.length === 0) {
      return res.status(404).json({ success: false, error: "None of the selected vacancies were found" });
    }

    const recipients = [];

    // Fetch selected active providers (only those with an email address)
    if (Array.isArray(provider_ids) && provider_ids.length > 0) {
      const { rows: providers } = await pool.query(
        `SELECT id, name, contact_name, email
         FROM providers
         WHERE id = ANY($1::uuid[])
           AND is_active = true
           AND email IS NOT NULL`,
        [provider_ids]
      );
      recipients.push(...providers);
    }

    // Include additional custom / test emails
    if (Array.isArray(additional_emails)) {
      for (const email of additional_emails) {
        const cleaned = String(email).trim();
        if (cleaned && cleaned.includes("@") && !recipients.some(r => r.email.toLowerCase() === cleaned.toLowerCase())) {
          recipients.push({
            id: `custom-${recipients.length}`,
            name: cleaned,
            contact_name: cleaned,
            email: cleaned,
          });
        }
      }
    }

    if (recipients.length === 0) {
      return res.status(400).json({ success: false, error: "No recipients found. Please select providers or enter a recipient email." });
    }

    const sentByName = req.user.name || req.user.email;
    const userId     = req.user.id;

    const results = await sendMultiVacancyBroadcast({
      jobs,
      providers:     recipients,
      sentByName,
      appUrl:        process.env.APP_URL,
      customSubject: custom_subject,
      customMessage: custom_message,
      customIntro:   custom_intro,
    });

    const sentCount = results.filter((r) => r.status === "sent").length;
    const failedCount = results.filter((r) => r.status === "failed").length;

    // Log in activity_log
    pool.query(
      `INSERT INTO activity_log (entity_type, entity_id, action, performed_by, metadata)
       VALUES ('job', $1, 'broadcast_multi_to_providers', $2, $3)`,
      [
        jobs[0].id,
        userId,
        JSON.stringify({
          job_ids:        jobs.map((j) => j.id),
          job_titles:     jobs.map((j) => j.title),
          sent_to:        results.map((r) => ({ id: r.provider_id, name: r.name, email: r.email, status: r.status, error: r.error })),
          sent_count:     sentCount,
          failed_count:   failedCount,
          custom_subject: custom_subject || null,
        }),
      ]
    ).catch(() => {});

    // Add timeline entry for each individual job
    const providerNames = results.filter((r) => r.status === "sent").map((r) => r.name || r.email).slice(0, 3).join(", ");
    const moreSuffix = sentCount > 3 ? ` +${sentCount - 3} more` : "";
    const comment = sentCount > 0
      ? `Multi-vacancy broadcast (${jobs.length} roles) sent to ${sentCount} provider${sentCount !== 1 ? "s" : ""} (${providerNames}${moreSuffix})`
      : `Multi-vacancy broadcast failed for all ${recipients.length} recipients`;

    for (const j of jobs) {
      pool.query(
        `INSERT INTO job_activity (job_id, user_id, job_status, comment)
         VALUES ($1, $2, 'broadcast', $3)`,
        [j.id, userId, comment]
      ).catch(() => {});
    }

    if (sentCount === 0 && recipients.length > 0) {
      const firstError = results.find((r) => r.error)?.error || "Email delivery failed";
      return res.status(502).json({
        success: false,
        error: `Could not deliver broadcast: ${firstError}. Please check SMTP configuration.`,
        data: { sent: 0, failed: failedCount, results },
      });
    }

    res.json({
      success: true,
      data: {
        sent:          sentCount,
        failed:        failedCount,
        jobs_count:    jobs.length,
        results,
        message:       `Consolidated broadcast with ${jobs.length} vacancies sent to ${sentCount} recipient${sentCount !== 1 ? "s" : ""}.${failedCount > 0 ? ` (${failedCount} failed)` : ""}`,
      },
    });
  } catch (err) { next(err); }
});

// ── POST /api/jobs/test-email ────────────────────────────────────────────────
// Live diagnostic endpoint to test and verify Zoho Mail sending
jobsRouter.post("/test-email", async (req, res, next) => {
  try {
    const targetEmail = (req.body.to || req.user.email || "connect@workvision.com.au").trim();
    const info = await sendEmail({
      to: targetEmail,
      subject: "WorkVision Australia – Email Diagnostic Test",
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:24px;border:1px solid #e2e8f0;border-radius:10px;max-width:520px;background:#ffffff;">
          <h2 style="color:#0f172a;margin:0 0 12px;font-size:20px;">Email System Operational</h2>
          <p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 16px;">This is a live diagnostic verification from WorkVision Australia ATS.</p>
          <table width="100%" style="font-size:13px;line-height:2;color:#334155;">
            <tr><td width="130" style="color:#64748b;font-weight:600;">Recipient:</td><td><strong>${targetEmail}</strong></td></tr>
            <tr><td style="color:#64748b;font-weight:600;">Initiated By:</td><td>${req.user.name || req.user.email}</td></tr>
            <tr><td style="color:#64748b;font-weight:600;">SMTP Host:</td><td>smtppro.zoho.com.au:465 (SSL)</td></tr>
            <tr><td style="color:#64748b;font-weight:600;">Timestamp:</td><td>${new Date().toLocaleString("en-AU", { timeZone: "Australia/Sydney" })} (AEST)</td></tr>
          </table>
          <hr style="border:none;border-top:1px solid #f1f5f9;margin:18px 0 12px;" />
          <p style="font-size:11px;color:#94a3b8;margin:0;">WorkVision Australia &bull; connect@workvision.com.au</p>
        </div>
      `,
      text: `WorkVision Australia – Email Diagnostic Test\nRecipient: ${targetEmail}\nInitiated by: ${req.user.name || req.user.email}\nTimestamp: ${new Date().toISOString()}`,
    });
    res.json({ success: true, data: { messageId: info.messageId, to: targetEmail, accepted: info.accepted } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
