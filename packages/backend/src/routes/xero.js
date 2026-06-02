import { Router } from "express";
import { pool } from "../config/db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import {
  buildXeroAuthUrl, parseXeroState, exchangeCodeForTokens,
  discoverTenant, saveConnection, getConnection, clearConnection,
  XeroNotConnectedError, XeroAuthError,
} from "../services/xero-auth.js";
import {
  searchContactsByName, searchContactsLike, createContact,
  createDraftInvoice, recordInvoice, listInvoicesForEnrolment,
  buildInvoiceDescription, XeroApiError,
} from "../services/xero.js";

export const xeroRouter = Router();

// ── Connection management ────────────────────────────────────────────────────
xeroRouter.get("/auth-url", requireAuth, requireRole("admin"), (req, res) => {
  const url = buildXeroAuthUrl(req.user.id);
  res.json({ success: true, data: { url } });
});

// Callback is intentionally not behind requireAuth — Xero hits this and the JWT
// `state` we sent proves the request originated from our auth-url handler.
xeroRouter.get("/callback", async (req, res, next) => {
  try {
    const { code, state, error } = req.query;
    if (error) return res.redirect(`/admin/xero?error=${encodeURIComponent(String(error))}`);
    if (!code || !state) return res.redirect("/admin/xero?error=missing_code_or_state");

    const decoded = parseXeroState(String(state));
    const tokens = await exchangeCodeForTokens(String(code));
    const tenant = await discoverTenant(tokens.access_token);
    await saveConnection({ tokens, tenant, userId: decoded.userId });

    res.redirect("/admin/xero?connected=true");
  } catch (err) {
    res.redirect(`/admin/xero?error=${encodeURIComponent(err.message || "callback_failed")}`);
  }
});

xeroRouter.get("/connection", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const conn = await getConnection();
    if (!conn) return res.json({ success: true, data: null });
    res.json({
      success: true,
      data: {
        tenant_id:          conn.tenant_id,
        tenant_name:        conn.tenant_name,
        connected_by_name:  conn.connected_by_name,
        connected_at:       conn.connected_at,
      },
    });
  } catch (err) { next(err); }
});

xeroRouter.delete("/connection", requireAuth, requireRole("admin"), async (req, res, next) => {
  try { await clearConnection(); res.json({ success: true }); }
  catch (err) { next(err); }
});

// ── Contacts ─────────────────────────────────────────────────────────────────
xeroRouter.get("/contacts", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const search = (req.query.search || "").toString().trim();
    if (!search) return res.json({ success: true, data: [] });
    const rows = await searchContactsLike(search);
    res.json({ success: true, data: rows });
  } catch (err) { next(handleXeroError(err)); }
});

xeroRouter.post("/contacts", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const { name, email } = req.body;
    if (!name) return res.status(400).json({ success: false, error: "name_required" });
    const c = await createContact({ name, email });
    res.status(201).json({ success: true, data: c });
  } catch (err) { next(handleXeroError(err)); }
});

// ── Invoices ─────────────────────────────────────────────────────────────────
xeroRouter.get("/invoices", requireAuth, async (req, res, next) => {
  try {
    const { candidate_training_id } = req.query;
    if (!candidate_training_id) return res.status(400).json({ success: false, error: "candidate_training_id_required" });
    const rows = await listInvoicesForEnrolment(String(candidate_training_id));
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

xeroRouter.post("/invoices", requireAuth, requireRole("admin", "recruiter_admin"), async (req, res, next) => {
  try {
    const { candidate_training_id, unit_price, quantity = 1, xero_contact_id } = req.body;
    if (!candidate_training_id || unit_price === undefined || unit_price === null) {
      return res.status(400).json({ success: false, error: "candidate_training_id and unit_price are required" });
    }

    // 1. Load context.
    const { rows } = await pool.query(
      `SELECT ct.id AS enrolment_id, ct.start_date, ct.end_date,
              c.id AS candidate_id, c.name AS candidate_name, c.provider_id,
              t.name AS training_name,
              p.id AS provider_pk, p.name AS provider_name, p.xero_contact_id AS cached_contact_id
         FROM candidate_trainings ct
         JOIN candidates c ON c.id = ct.candidate_id
         JOIN trainings  t ON t.id = ct.training_id
         LEFT JOIN providers p ON p.id = c.provider_id
        WHERE ct.id = $1`,
      [candidate_training_id]
    );
    if (!rows[0]) return res.status(404).json({ success: false, error: "enrolment_not_found" });
    const ctx = rows[0];
    if (!ctx.provider_pk) return res.status(400).json({ success: false, error: "candidate_has_no_provider" });

    // 2. Resolve Xero contact.
    let resolvedContactId = xero_contact_id || ctx.cached_contact_id || null;
    if (!resolvedContactId) {
      const matches = await searchContactsByName(ctx.provider_name);
      if (matches.length === 1) {
        resolvedContactId = matches[0].contact_id;
      } else {
        return res.status(409).json({
          success: false,
          error: "ambiguous_xero_contact",
          data: { candidates: matches },
        });
      }
    }

    // 3. Persist the contact link on the provider row if it wasn't there.
    if (resolvedContactId !== ctx.cached_contact_id) {
      await pool.query(`UPDATE providers SET xero_contact_id = $1 WHERE id = $2`, [resolvedContactId, ctx.provider_pk]);
    }

    // 4. Build description + create invoice in Xero.
    const description = buildInvoiceDescription({
      trainingName:  ctx.training_name,
      candidateName: ctx.candidate_name,
      startDate:     ctx.start_date ? new Date(ctx.start_date).toISOString().slice(0, 10) : null,
      endDate:       ctx.end_date   ? new Date(ctx.end_date).toISOString().slice(0, 10)   : null,
    });
    const invoice = await createDraftInvoice({
      contactId: resolvedContactId,
      description,
      quantity:  Number(quantity),
      unitPrice: Number(unit_price),
    });

    // 5. Record the invoice + activity log.
    const row = await recordInvoice({
      candidate_training_id,
      xero_invoice_id:     invoice.xero_invoice_id,
      xero_invoice_number: invoice.xero_invoice_number,
      xero_contact_id:     resolvedContactId,
      status:              "DRAFT",
      total_amount:        invoice.total_amount,
      currency_code:       invoice.currency_code,
      xero_response:       invoice.raw,
      created_by:          req.user.id,
    });
    await pool.query(
      `INSERT INTO activity_log (entity_type, entity_id, action, performed_by, metadata)
       VALUES ('candidate_training', $1, 'invoice_generated', $2, $3)`,
      [candidate_training_id, req.user.id, JSON.stringify({
        xero_invoice_id: invoice.xero_invoice_id,
        xero_invoice_number: invoice.xero_invoice_number,
        total_amount: invoice.total_amount,
      })]
    );

    res.status(201).json({ success: true, data: row });
  } catch (err) { next(handleXeroError(err)); }
});

// ── Error mapper — gives meaningful HTTP codes for the typed errors ─────────
function handleXeroError(err) {
  if (err instanceof XeroNotConnectedError) {
    const e = new Error("xero_not_connected"); e.status = 412; return e;
  }
  if (err instanceof XeroAuthError) {
    const e = new Error(err.message); e.status = 401; return e;
  }
  if (err instanceof XeroApiError) {
    const status = err.status === 429 ? 429 : err.status >= 500 ? 502 : err.status >= 400 ? 400 : 502;
    const e = new Error(err.message); e.status = status; e.body = err.body; return e;
  }
  return err;
}
