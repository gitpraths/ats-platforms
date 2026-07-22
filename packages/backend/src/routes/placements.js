import { Router } from "express";
import { pool } from "../config/db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { sendPlacementConfirmation, sendWelfareCheckEmail } from "../services/email.js";

export const placementsRouter = Router();
placementsRouter.use(requireAuth);

const WELFARE_OFFSETS = [
  { check_type: "day_1",   days: 1 },
  { check_type: "week_1",  days: 7 },
  { check_type: "month_1", months: 1 },
  { check_type: "month_3", months: 3 },
  { check_type: "month_6", months: 6 },
];

function welfareCheckDueDate(startDate, offset) {
  const d = new Date(startDate);
  if (offset.days)   d.setDate(d.getDate() + offset.days);
  if (offset.months) d.setMonth(d.getMonth() + offset.months);
  return d.toISOString().split("T")[0];
}

async function generateWelfareChecks(client, placementId, startDate) {
  for (const offset of WELFARE_OFFSETS) {
    const dueDate = welfareCheckDueDate(startDate, offset);
    await client.query(
      `INSERT INTO welfare_checks (placement_id, check_type, due_date) VALUES ($1, $2, $3)`,
      [placementId, offset.check_type, dueDate]
    );
  }
}

// ── GET /api/placements ──────────────────────────────────
placementsRouter.get("/", async (req, res, next) => {
  try {
    const { page = 1, limit = 20, employer_id, provider_id, job_id, candidate_id } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const conditions = [];
    const params = [];
    let idx = 1;

    // Provider scope: providers only see their own candidates' placements
    if (req.user.role === "provider") {
      conditions.push(`c.provider_id = $${idx}`);
      params.push(req.user.provider_id);
      idx++;
    } else {
      if (provider_id) { conditions.push(`c.provider_id = $${idx}`); params.push(provider_id); idx++; }
    }

    if (employer_id) { conditions.push(`p.employer_id = $${idx}`); params.push(employer_id); idx++; }
    if (job_id)      { conditions.push(`p.job_id = $${idx}`);      params.push(job_id);      idx++; }
    if (candidate_id){ conditions.push(`p.candidate_id = $${idx}`);params.push(candidate_id);idx++; }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const { rows } = await pool.query(
      `SELECT p.id, p.application_id, p.candidate_id, p.job_id, p.employer_id,
              p.start_date, p.end_date, p.employment_status,
              p.confirmed_by_employer, p.confirmation_sent_at,
              p.notes, p.created_at, p.updated_at,
              p.wagesub_status, p.wagesub_4wk_paid_at, p.wagesub_13wk_paid_at, p.wagesub_26wk_paid_at, p.wagesub_notes,
              c.name AS candidate_name, c.work_status AS candidate_work_status,
              c.wage_subsidy, c.wage_subsidy_amount, c.provider_id,
              j.title AS job_title,
              e.name  AS employer_name,
              pr.name AS provider_name
       FROM placements p
       JOIN candidates c  ON c.id = p.candidate_id
       JOIN jobs j        ON j.id = p.job_id
       LEFT JOIN employers e  ON e.id = p.employer_id
       LEFT JOIN providers pr ON pr.id = c.provider_id
       ${where}
       ORDER BY p.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, Number(limit), offset]
    );

    const { rows: [{ total }] } = await pool.query(
      `SELECT COUNT(*)::int AS total 
       FROM placements p
       JOIN candidates c  ON c.id = p.candidate_id
       ${where}`,
      params
    );

    // Attach welfare check dots
    const ids = rows.map((r) => r.id);
    let wcMap = {};
    if (ids.length) {
      const { rows: wcs } = await pool.query(
        `SELECT placement_id, check_type, due_date, completed_at, email_sent_at
         FROM welfare_checks WHERE placement_id = ANY($1)`,
        [ids]
      );
      for (const wc of wcs) {
        if (!wcMap[wc.placement_id]) wcMap[wc.placement_id] = [];
        wcMap[wc.placement_id].push(wc);
      }
    }

    const data = rows.map((r) => ({ ...r, welfare_checks: wcMap[r.id] || [] }));

    res.json({ success: true, data, meta: { total, page: Number(page), limit: Number(limit) } });
  } catch (err) { next(err); }
});

// ── GET /api/placements/:id ──────────────────────────────
placementsRouter.get("/:id", async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.*,
              c.name AS candidate_name, c.work_status AS candidate_work_status, c.provider_id,
              j.title AS job_title, j.job_type,
              e.name AS employer_name, e.contact_email AS employer_email, e.contact_name AS employer_contact,
              pr.name AS provider_name
       FROM placements p
       JOIN candidates c  ON c.id = p.candidate_id
       JOIN jobs j        ON j.id = p.job_id
       LEFT JOIN employers e  ON e.id = p.employer_id
       LEFT JOIN providers pr ON pr.id = c.provider_id
       WHERE p.id = $1`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ success: false, error: "Placement not found" });

    // Provider scope check
    if (req.user.role === "provider" && rows[0].provider_id !== req.user.provider_id) {
      return res.status(403).json({ success: false, error: "Forbidden" });
    }

    const { rows: wcs } = await pool.query(
      `SELECT * FROM welfare_checks WHERE placement_id = $1 ORDER BY due_date ASC`,
      [req.params.id]
    );

    res.json({ success: true, data: { ...rows[0], welfare_checks: wcs } });
  } catch (err) { next(err); }
});

// ── POST /api/placements ─────────────────────────────────
placementsRouter.post("/", requireRole("admin", "recruiter_admin", "recruiter"), async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { application_id, candidate_id, job_id, employer_id, start_date, notes } = req.body;
    if (!application_id || !candidate_id || !job_id || !start_date) {
      return res.status(400).json({ success: false, error: "application_id, candidate_id, job_id, start_date are required" });
    }

    await client.query("BEGIN");

    // Enforce business rule: Single Active Placement
    const { rows: existing } = await client.query(
      `SELECT id FROM placements WHERE candidate_id = $1 AND end_date IS NULL`,
      [candidate_id]
    );
    if (existing.length > 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, error: "This candidate already has an active placement. Please end their current placement before creating a new one." });
    }

    const { rows } = await client.query(
      `INSERT INTO placements (application_id, candidate_id, job_id, employer_id, start_date, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [application_id, candidate_id, job_id, employer_id || null, start_date, notes || null, req.user.id]
    );
    const placement = rows[0];

    // Auto-generate 5 welfare checks
    await generateWelfareChecks(client, placement.id, start_date);

    // Update application stage to hired
    await client.query(
      `UPDATE applications SET stage = 'hired', updated_at = NOW() WHERE id = $1 AND stage != 'hired'`,
      [application_id]
    );

    // Update candidate work_status to placed
    await client.query(
      `UPDATE candidates SET work_status = 'placed', updated_at = NOW() WHERE id = $1`,
      [candidate_id]
    );

    await client.query(
      `INSERT INTO activity_log (entity_type, entity_id, action, performed_by, metadata)
       VALUES ('placement', $1, 'created', $2, $3)`,
      [placement.id, req.user.id, JSON.stringify({ candidate_id, job_id, start_date })]
    );

    await client.query("COMMIT");
    res.status(201).json({ success: true, data: placement });
  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
});

// ── PUT /api/placements/:id ──────────────────────────────
placementsRouter.put("/:id", requireRole("admin", "recruiter_admin", "recruiter"), async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { start_date, notes, confirmed_by_employer, employer_id } = req.body;

    const { rows: existing } = await client.query("SELECT * FROM placements WHERE id = $1", [req.params.id]);
    if (!existing[0]) return res.status(404).json({ success: false, error: "Placement not found" });

    await client.query("BEGIN");

    const { rows } = await client.query(
      `UPDATE placements
       SET start_date           = COALESCE($1, start_date),
           notes                = COALESCE($2, notes),
           confirmed_by_employer= COALESCE($3, confirmed_by_employer),
           employer_id          = COALESCE($4, employer_id),
           updated_at           = NOW()
       WHERE id = $5 RETURNING *`,
      [start_date, notes, confirmed_by_employer, employer_id, req.params.id]
    );

    // If start_date changed, recalculate uncompleted welfare check due dates
    if (start_date && start_date !== existing[0].start_date) {
      for (const offset of WELFARE_OFFSETS) {
        const dueDate = welfareCheckDueDate(start_date, offset);
        await client.query(
          `UPDATE welfare_checks SET due_date = $1
           WHERE placement_id = $2 AND check_type = $3 AND completed_at IS NULL`,
          [dueDate, req.params.id, offset.check_type]
        );
      }
    }

    await client.query("COMMIT");

    pool.query(
      `INSERT INTO activity_log (entity_type, entity_id, action, performed_by)
       VALUES ('placement', $1, 'updated', $2)`,
      [req.params.id, req.user.id]
    ).catch(() => {});

    res.json({ success: true, data: rows[0] });
  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
});

// ── PATCH /api/placements/:id ─────────────────────────────
// Lightweight update: employment_status, end_date, notes, wagesub fields
placementsRouter.patch("/:id", requireRole("admin", "recruiter_admin", "recruiter"), async (req, res, next) => {
  const client = await pool.connect();
  try {
    const {
      employment_status, end_date, notes,
      wagesub_status,
      wagesub_4wk_paid_at, wagesub_13wk_paid_at, wagesub_26wk_paid_at,
      wagesub_notes,
    } = req.body;

    const { rows: existing } = await client.query("SELECT id FROM placements WHERE id = $1", [req.params.id]);
    if (!existing[0]) return res.status(404).json({ success: false, error: "Placement not found" });

    const { rows } = await client.query(
      `UPDATE placements
       SET employment_status    = COALESCE($1,  employment_status),
           end_date             = $2,
           notes                = COALESCE($3,  notes),
           wagesub_status       = COALESCE($4,  wagesub_status),
           wagesub_4wk_paid_at  = $5,
           wagesub_13wk_paid_at = $6,
           wagesub_26wk_paid_at = $7,
           wagesub_notes        = COALESCE($8,  wagesub_notes),
           updated_at           = NOW()
       WHERE id = $9 RETURNING *`,
      [
        employment_status    ?? null,
        end_date             ?? null,
        notes                ?? null,
        wagesub_status       ?? null,
        wagesub_4wk_paid_at  !== undefined ? (wagesub_4wk_paid_at  || null) : undefined,
        wagesub_13wk_paid_at !== undefined ? (wagesub_13wk_paid_at || null) : undefined,
        wagesub_26wk_paid_at !== undefined ? (wagesub_26wk_paid_at || null) : undefined,
        wagesub_notes        ?? null,
        req.params.id,
      ]
    );

    pool.query(
      `INSERT INTO activity_log (entity_type, entity_id, action, performed_by)
       VALUES ('placement', $1, 'updated', $2)`,
      [req.params.id, req.user.id]
    ).catch(() => {});

    res.json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  } finally {
    client.release();
  }
});

// ── DELETE /api/placements/:id ───────────────────────────
placementsRouter.delete("/:id", requireRole("admin"), async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { rows } = await client.query("SELECT * FROM placements WHERE id = $1", [req.params.id]);
    if (!rows[0]) return res.status(404).json({ success: false, error: "Placement not found" });

    await client.query("BEGIN");
    await client.query("DELETE FROM placements WHERE id = $1", [req.params.id]);
    await client.query(
      `UPDATE candidates SET work_status = 'job_seeking', updated_at = NOW() WHERE id = $1`,
      [rows[0].candidate_id]
    );
    await client.query("COMMIT");

    res.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
});

// ── POST /api/placements/:id/send-confirmation ───────────
placementsRouter.post("/:id/send-confirmation", requireRole("admin", "recruiter_admin", "recruiter"), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.*, c.name AS candidate_name, j.title AS job_title,
              e.name AS employer_name, e.contact_name, e.contact_email
       FROM placements p
       JOIN candidates c ON c.id = p.candidate_id
       JOIN jobs j       ON j.id = p.job_id
       LEFT JOIN employers e ON e.id = p.employer_id
       WHERE p.id = $1`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ success: false, error: "Placement not found" });

    const placement = rows[0];
    if (!placement.contact_email) {
      return res.status(400).json({ success: false, error: "Employer has no contact email" });
    }

    await sendPlacementConfirmation({
      placement,
      employer: { contact_name: placement.contact_name, contact_email: placement.contact_email, name: placement.employer_name },
      candidate: { name: placement.candidate_name },
      job: { title: placement.job_title },
    });

    await pool.query(
      `UPDATE placements SET confirmation_sent_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [req.params.id]
    );

    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── GET /api/placements/:id/welfare-checks ───────────────
placementsRouter.get("/:id/welfare-checks", async (req, res, next) => {
  try {
    const { rows: placement } = await pool.query(
      `SELECT p.id, c.provider_id FROM placements p JOIN candidates c ON c.id = p.candidate_id WHERE p.id = $1`,
      [req.params.id]
    );
    if (!placement[0]) return res.status(404).json({ success: false, error: "Placement not found" });

    if (req.user.role === "provider" && placement[0].provider_id !== req.user.provider_id) {
      return res.status(403).json({ success: false, error: "Forbidden" });
    }

    const { rows } = await pool.query(
      `SELECT * FROM welfare_checks WHERE placement_id = $1 ORDER BY due_date ASC`,
      [req.params.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// ── PATCH /api/welfare-checks/:id ───────────────────────
// Mounted separately in app.js as /api/welfare-checks
export const welfareChecksRouter = Router();
welfareChecksRouter.use(requireAuth);

welfareChecksRouter.patch("/:id", requireRole("admin", "recruiter_admin", "recruiter"), async (req, res, next) => {
  try {
    const { employer_response, completed_at } = req.body;

    const { rows: existing } = await pool.query("SELECT * FROM welfare_checks WHERE id = $1", [req.params.id]);
    if (!existing[0]) return res.status(404).json({ success: false, error: "Welfare check not found" });
    if (existing[0].completed_at) {
      return res.status(400).json({ success: false, error: "Welfare check is already completed" });
    }

    const { rows } = await pool.query(
      `UPDATE welfare_checks
       SET completed_at     = COALESCE($1, NOW()),
           employer_response= $2
       WHERE id = $3 RETURNING *`,
      [completed_at || null, employer_response || null, req.params.id]
    );
    res.json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
});

welfareChecksRouter.post("/:id/send-email", requireRole("admin", "recruiter_admin", "recruiter"), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT wc.*,
              p.start_date, p.id AS placement_id,
              c.name AS candidate_name,
              j.title AS job_title,
              e.name AS employer_name, e.contact_name, e.contact_email
       FROM welfare_checks wc
       JOIN placements p  ON p.id = wc.placement_id
       JOIN candidates c  ON c.id = p.candidate_id
       JOIN jobs j        ON j.id = p.job_id
       LEFT JOIN employers e ON e.id = p.employer_id
       WHERE wc.id = $1`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ success: false, error: "Welfare check not found" });

    const wc = rows[0];
    if (!wc.contact_email) {
      return res.status(400).json({ success: false, error: "Employer has no contact email" });
    }

    await sendWelfareCheckEmail({
      welfareCheck: { check_type: wc.check_type, due_date: wc.due_date },
      placement: { start_date: wc.start_date },
      employer: { contact_name: wc.contact_name, contact_email: wc.contact_email, name: wc.employer_name },
      candidate: { name: wc.candidate_name },
      job: { title: wc.job_title },
    });

    await pool.query(
      `UPDATE welfare_checks SET email_sent_at = NOW() WHERE id = $1`,
      [req.params.id]
    );

    res.json({ success: true });
  } catch (err) { next(err); }
});
