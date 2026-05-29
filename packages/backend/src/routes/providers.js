import { Router } from "express";
import { pool } from "../config/db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { runSync, resolveShareUrl } from '../services/spreadsheet.js';
import { getValidAccessToken } from '../services/ms-auth.js';

export const providersRouter = Router();
providersRouter.use(requireAuth);

// ── GET /api/providers ───────────────────────────────────
providersRouter.get("/", async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search = "" } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const like = `%${search}%`;

    const { rows } = await pool.query(
      `SELECT p.*,
              COUNT(DISTINCT c.id)::int AS candidate_count
       FROM providers p
       LEFT JOIN candidates c ON c.provider_id = p.id
       WHERE p.name ILIKE $1 OR p.contact_name ILIKE $1 OR p.email ILIKE $1
       GROUP BY p.id
       ORDER BY p.name
       LIMIT $2 OFFSET $3`,
      [like, Number(limit), offset]
    );

    const { rows: [{ total }] } = await pool.query(
      `SELECT COUNT(*)::int AS total FROM providers
       WHERE name ILIKE $1 OR contact_name ILIKE $1 OR email ILIKE $1`,
      [like]
    );

    res.json({ success: true, data: rows, meta: { total, page: Number(page), limit: Number(limit) } });
  } catch (err) { next(err); }
});

// ── GET /api/providers/:id ───────────────────────────────
providersRouter.get("/:id", async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.*,
              COUNT(DISTINCT c.id)::int AS candidate_count,
              COUNT(DISTINCT c.id) FILTER (WHERE c.work_status = 'placed')::int       AS placed_count,
              COUNT(DISTINCT c.id) FILTER (WHERE c.work_status = 'job_seeking')::int  AS job_seeking_count,
              COUNT(DISTINCT c.id) FILTER (WHERE c.work_status = 'employed')::int     AS employed_count,
              COUNT(DISTINCT c.id) FILTER (WHERE c.work_status = 'inactive')::int     AS inactive_count
       FROM providers p
       LEFT JOIN candidates c ON c.provider_id = p.id
       WHERE p.id = $1
       GROUP BY p.id`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ success: false, error: "Provider not found" });

    const { rows: candidates } = await pool.query(
      `SELECT id, name, work_status, created_at
       FROM candidates WHERE provider_id = $1
       ORDER BY created_at DESC LIMIT 5`,
      [req.params.id]
    );

    res.json({ success: true, data: { ...rows[0], recent_candidates: candidates } });
  } catch (err) { next(err); }
});

// ── POST /api/providers ──────────────────────────────────
providersRouter.post("/", requireRole("admin", "recruiter_admin"), async (req, res, next) => {
  try {
    const { name, contact_name, email, phone, address, is_active = true } = req.body;
    if (!name) return res.status(400).json({ success: false, error: "name is required" });

    const { rows } = await pool.query(
      `INSERT INTO providers (name, contact_name, email, phone, address, is_active)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [name, contact_name || null, email || null, phone || null, address || null, is_active]
    );

    pool.query(
      `INSERT INTO activity_log (entity_type, entity_id, action, performed_by, metadata)
       VALUES ('provider', $1, 'created', $2, $3)`,
      [rows[0].id, req.user.id, JSON.stringify({ name })]
    ).catch(() => {});

    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
});

// ── PUT /api/providers/:id ───────────────────────────────
providersRouter.put("/:id", requireRole("admin", "recruiter_admin"), async (req, res, next) => {
  try {
    const { name, contact_name, email, phone, address, is_active } = req.body;

    const { rows } = await pool.query(
      `UPDATE providers
       SET name        = COALESCE($1, name),
           contact_name= COALESCE($2, contact_name),
           email       = COALESCE($3, email),
           phone       = COALESCE($4, phone),
           address     = COALESCE($5, address),
           is_active   = COALESCE($6, is_active),
           updated_at  = NOW()
       WHERE id = $7 RETURNING *`,
      [name, contact_name, email, phone, address, is_active, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ success: false, error: "Provider not found" });

    pool.query(
      `INSERT INTO activity_log (entity_type, entity_id, action, performed_by)
       VALUES ('provider', $1, 'updated', $2)`,
      [req.params.id, req.user.id]
    ).catch(() => {});

    res.json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
});

// ── DELETE /api/providers/:id (soft delete) ──────────────
providersRouter.delete("/:id", requireRole("admin"), async (req, res, next) => {
  try {
    const { rows: active } = await pool.query(
      `SELECT COUNT(*)::int AS cnt FROM candidates
       WHERE provider_id = $1 AND work_status != 'inactive'`,
      [req.params.id]
    );
    if (active[0].cnt > 0) {
      return res.status(409).json({ success: false, error: "Provider has active candidates. Deactivate them first." });
    }

    const { rows } = await pool.query(
      `UPDATE providers SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING id`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ success: false, error: "Provider not found" });

    pool.query(
      `INSERT INTO activity_log (entity_type, entity_id, action, performed_by)
       VALUES ('provider', $1, 'deactivated', $2)`,
      [req.params.id, req.user.id]
    ).catch(() => {});

    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── PATCH /api/providers/:id/spreadsheet ─────────────────
providersRouter.patch('/:id/spreadsheet', requireRole('admin', 'recruiter_admin'), async (req, res, next) => {
  try {
    const { onedrive_url, onedrive_sheet_name = 'Sheet1' } = req.body;
    if (!onedrive_url) {
      return res.status(400).json({ success: false, error: 'onedrive_url is required' });
    }

    const { rows } = await pool.query('SELECT * FROM providers WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, error: 'Provider not found' });
    const provider = rows[0];

    if (!provider.ms_access_token) {
      return res.status(409).json({ success: false, error: 'Connect OneDrive first before saving spreadsheet' });
    }

    const tokenResult = await getValidAccessToken(provider);
    const fileId = await resolveShareUrl(tokenResult.accessToken, onedrive_url);

    await pool.query(
      `UPDATE providers SET onedrive_file_id=$1, onedrive_sheet_name=$2 WHERE id=$3`,
      [fileId, onedrive_sheet_name, req.params.id]
    );

    res.json({ success: true, data: { onedrive_file_id: fileId, onedrive_sheet_name } });
  } catch (err) { next(err); }
});

// ── POST /api/providers/:id/sync ─────────────────────────
providersRouter.post('/:id/sync', requireRole('admin', 'recruiter_admin'), async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM providers WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, error: 'Provider not found' });

    const provider = rows[0];

    if (!provider.ms_access_token || !provider.onedrive_file_id) {
      return res.status(409).json({ success: false, error: 'Provider spreadsheet not connected' });
    }

    const result = await runSync(provider, req.user.id);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

// ── GET /api/providers/:id/sync-logs ─────────────────────
providersRouter.get('/:id/sync-logs', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT psl.*, u.name AS triggered_by_name
       FROM provider_sync_logs psl
       LEFT JOIN users u ON u.id = psl.triggered_by
       WHERE psl.provider_id = $1
       ORDER BY psl.started_at DESC
       LIMIT 20`,
      [req.params.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});
