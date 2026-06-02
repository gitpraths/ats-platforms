# Xero Invoicing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add manual per-enrolment Xero invoice generation to MyATS, with a single MyATS-wide Xero connection, auto-linking of providers to Xero contacts, DRAFT invoices carrying candidate name and training dates, and a `unit_price` field on the training catalogue.

**Architecture:** Mirrors the existing per-provider Microsoft Graph integration. Two new backend service modules (`xero-auth.js` for OAuth + token refresh, `xero.js` for contacts + invoices via raw `fetch`) behind a new `/api/xero/*` Express router. Two new tables (`xero_connection` as a singleton, `xero_invoices` for the audit trail). One new column each on `trainings` (`unit_price`) and `providers` (`xero_contact_id`). Frontend adds an `/admin/xero` connection management page, a `GenerateInvoiceDialog` reused from both the Candidate Detail Training panel and the `/training` Enrolments tab, and a small Xero-contact widget on Provider Detail.

**Tech Stack:** Express, PostgreSQL (`pg`), Node `fetch` (no SDK), React 18 + TypeScript, TanStack Query, shadcn/ui.

**Source spec:** `docs/superpowers/specs/2026-06-02-xero-invoicing-design.md` — §2 (schema), §3 (OAuth), §4 (generation flow), §5 (API), §6 (errors). Testing requirements are explicitly out of scope per user instruction.

**Prerequisites — set in Railway before Task 9 manual smoke:**
- `XERO_CLIENT_ID` — from a Xero developer-portal app
- `XERO_CLIENT_SECRET`
- `XERO_REDIRECT_URI` — e.g. `https://ats-platforms-production.up.railway.app/api/xero/callback`
- `XERO_SCOPES` — `offline_access accounting.contacts accounting.transactions`
- `XERO_REVENUE_ACCOUNT_CODE` — optional, defaults to `200`
- `TOKEN_ENCRYPTION_KEY` — already set (reused from MS Graph integration)
- `JWT_SECRET` — already set (reused for OAuth state)

---

## File map

**Backend — new files:**
- `database/013-xero-invoicing.sql`
- `packages/backend/src/services/xero-auth.js` — OAuth + token refresh + tenant discovery
- `packages/backend/src/services/xero.js` — contact search/create + invoice create
- `packages/backend/src/routes/xero.js` — all `/api/xero/*` routes

**Backend — modified files:**
- `packages/backend/src/app.js` — mount `xeroRouter`
- `packages/backend/src/services/trainings.js` — accept `unit_price` in create/update
- `packages/backend/src/routes/trainings.js` — pass `unit_price` through
- `packages/backend/src/routes/providers.js` — whitelist `xero_contact_id` on PATCH

**Frontend — new files:**
- `packages/frontend/src/hooks/useXero.ts`
- `packages/frontend/src/pages/AdminXero.tsx`
- `packages/frontend/src/components/training/GenerateInvoiceDialog.tsx`

**Frontend — modified files:**
- `packages/frontend/src/types/index.ts` — Xero-related types
- `packages/frontend/src/App.tsx` — route + admin nav entry
- `packages/frontend/src/pages/AdminTrainings.tsx` — `unit_price` input in the catalogue dialog
- `packages/frontend/src/pages/CandidateDetail.tsx` — wire `GenerateInvoiceDialog` into the Training panel row actions
- `packages/frontend/src/components/training/EnrolmentsTab.tsx` — wire the same into row actions
- `packages/frontend/src/pages/ProviderDetail.tsx` — show "Xero contact" with link/unlink controls

---

## Task 1: Database migration

**Files:**
- Create: `database/013-xero-invoicing.sql`

- [ ] **Step 1: Create the migration file**

Path: `database/013-xero-invoicing.sql`

```sql
-- Migration 013: Xero invoicing integration
-- Catalogue price, per-provider Xero contact cache, Xero OAuth singleton,
-- and per-invoice audit table.

ALTER TABLE trainings
  ADD COLUMN IF NOT EXISTS unit_price NUMERIC(10, 2);

ALTER TABLE providers
  ADD COLUMN IF NOT EXISTS xero_contact_id VARCHAR(36);

CREATE TABLE IF NOT EXISTS xero_connection (
  id              SERIAL PRIMARY KEY,
  tenant_id       VARCHAR(255) NOT NULL,
  tenant_name     VARCHAR(255),
  access_token    TEXT NOT NULL,
  refresh_token   TEXT NOT NULL,
  token_expiry    TIMESTAMPTZ NOT NULL,
  connected_by    UUID REFERENCES users(id),
  connected_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS xero_invoices (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_training_id   UUID NOT NULL REFERENCES candidate_trainings(id) ON DELETE CASCADE,
  xero_invoice_id         VARCHAR(36)  NOT NULL,
  xero_invoice_number     VARCHAR(50),
  xero_contact_id         VARCHAR(36)  NOT NULL,
  status                  VARCHAR(20)  NOT NULL DEFAULT 'DRAFT',
  total_amount            NUMERIC(10, 2),
  currency_code           VARCHAR(3)   NOT NULL DEFAULT 'AUD',
  xero_response           JSONB,
  created_by              UUID REFERENCES users(id),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS xi_candidate_training_idx ON xero_invoices(candidate_training_id);
```

- [ ] **Step 2: Apply migration to local DB**

Run: `psql "$DATABASE_URL" -f database/013-xero-invoicing.sql`
Expected: `ALTER TABLE`, `CREATE TABLE`, `CREATE INDEX` notices, no errors.

- [ ] **Step 3: Verify**

Run: `psql "$DATABASE_URL" -c "\d xero_connection" -c "\d xero_invoices"`
Expected: both `\d` describes succeed with all columns from the migration.

- [ ] **Step 4: Commit**

```bash
git add database/013-xero-invoicing.sql
git commit -m "feat(db): add xero invoicing tables and provider/training columns"
```

---

## Task 2: Catalogue `unit_price` support (backend + frontend)

**Files:**
- Modify: `packages/backend/src/services/trainings.js`
- Modify: `packages/backend/src/routes/trainings.js`
- Modify: `packages/frontend/src/types/index.ts`
- Modify: `packages/frontend/src/pages/AdminTrainings.tsx`

- [ ] **Step 1: Extend `services/trainings.js` to accept `unit_price`**

Open `packages/backend/src/services/trainings.js`. In `createTraining`, add `unit_price` to the destructured fields and the INSERT:

Replace:
```js
export async function createTraining({ name, code, description, duration_days, provider_id, is_active }) {
  const { rows } = await pool.query(
    `INSERT INTO trainings (name, code, description, duration_days, provider_id, is_active)
     VALUES ($1, $2, $3, $4, $5, COALESCE($6, true))
     RETURNING *`,
    [name, code || null, description || null, duration_days || null, provider_id || null, is_active]
  );
  return rows[0];
}
```

With:
```js
export async function createTraining({ name, code, description, duration_days, provider_id, is_active, unit_price }) {
  const { rows } = await pool.query(
    `INSERT INTO trainings (name, code, description, duration_days, provider_id, is_active, unit_price)
     VALUES ($1, $2, $3, $4, $5, COALESCE($6, true), $7)
     RETURNING *`,
    [name, code || null, description || null, duration_days || null, provider_id || null, is_active, unit_price ?? null]
  );
  return rows[0];
}
```

In `updateTraining`, add the same field to the destructure, SET clause, and params array:

Replace the existing function body with:
```js
export async function updateTraining(id, { name, code, description, duration_days, provider_id, is_active, unit_price }) {
  const { rows } = await pool.query(
    `UPDATE trainings
        SET name          = COALESCE($1, name),
            code          = COALESCE($2, code),
            description   = COALESCE($3, description),
            duration_days = COALESCE($4, duration_days),
            provider_id   = COALESCE($5, provider_id),
            is_active     = COALESCE($6, is_active),
            unit_price    = COALESCE($7, unit_price),
            updated_at    = NOW()
      WHERE id = $8
      RETURNING *`,
    [name, code, description, duration_days, provider_id, is_active, unit_price, id]
  );
  return rows[0] || null;
}
```

- [ ] **Step 2: Routes pass through unchanged**

Open `packages/backend/src/routes/trainings.js` and verify the POST and PATCH handlers pass `req.body` directly into `createTraining`/`updateTraining` (they do today). No changes needed — the new field flows through automatically.

- [ ] **Step 3: Add `unit_price` to the frontend `Training` type**

Open `packages/frontend/src/types/index.ts`. Find the `Training` interface (added in the training module Phase 1). Add one line:

```ts
export interface Training {
  // existing fields...
  unit_price: number | null;
}
```

- [ ] **Step 4: Add `unit_price` input to the AdminTrainings dialog**

Open `packages/frontend/src/pages/AdminTrainings.tsx`. In `TrainingFormDialog`, add a new state hook alongside the others:

```tsx
const [unitPrice, setUnitPrice] = useState<string>(training?.unit_price?.toString() ?? "");
```

In `handleSave`, add `unit_price` to the body object:

```tsx
const body = {
  name: name.trim(),
  code: code.trim() || null,
  description: description.trim() || null,
  duration_days: durationDays ? Number(durationDays) : null,
  provider_id: providerId || null,
  is_active: isActive,
  unit_price: unitPrice ? Number(unitPrice) : null,
};
```

In the JSX, add the price input inside the existing `grid grid-cols-2 gap-3` row (so it sits alongside the duration input). Replace that whole grid block:

```tsx
<div className="grid grid-cols-2 gap-3">
  <div>
    <label className="text-xs text-slate-500">Code</label>
    <input value={code} onChange={(e) => setCode(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
  </div>
  <div>
    <label className="text-xs text-slate-500">Duration (days)</label>
    <input type="number" value={durationDays} onChange={(e) => setDurationDays(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
  </div>
</div>
<div>
  <label className="text-xs text-slate-500">Unit price (AUD)</label>
  <input
    type="number" step="0.01" value={unitPrice}
    onChange={(e) => setUnitPrice(e.target.value)}
    placeholder="e.g. 150.00"
    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
  />
</div>
```

- [ ] **Step 5: Verify type-check + build**

Run: `cd packages/frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add packages/backend/src/services/trainings.js \
        packages/frontend/src/types/index.ts \
        packages/frontend/src/pages/AdminTrainings.tsx
git commit -m "feat(trainings): add unit_price to catalogue"
```

---

## Task 3: Xero auth service

**Files:**
- Create: `packages/backend/src/services/xero-auth.js`

- [ ] **Step 1: Write the service module**

Path: `packages/backend/src/services/xero-auth.js`

```js
import jwt from "jsonwebtoken";
import { pool } from "../config/db.js";
import { encryptToken, decryptToken } from "./ms-auth.js";

const TOKEN_URL = "https://identity.xero.com/connect/token";
const CONNECTIONS_URL = "https://api.xero.com/connections";

export class XeroNotConnectedError extends Error {
  constructor() {
    super("xero_not_connected");
    this.name = "XeroNotConnectedError";
  }
}
export class XeroAuthError extends Error {
  constructor(message) {
    super(message);
    this.name = "XeroAuthError";
  }
}

export function buildXeroAuthUrl(userId) {
  const state = jwt.sign({ userId, kind: "xero" }, process.env.JWT_SECRET, { expiresIn: "10m" });
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.XERO_CLIENT_ID,
    redirect_uri: process.env.XERO_REDIRECT_URI,
    scope: process.env.XERO_SCOPES || "offline_access accounting.contacts accounting.transactions",
    state,
  });
  return `https://login.xero.com/identity/connect/authorize?${params.toString()}`;
}

export function parseXeroState(state) {
  const decoded = jwt.verify(state, process.env.JWT_SECRET);
  if (decoded.kind !== "xero") throw new Error("invalid_state_kind");
  return decoded;
}

async function postTokenRequest(body) {
  const basic = Buffer.from(`${process.env.XERO_CLIENT_ID}:${process.env.XERO_CLIENT_SECRET}`).toString("base64");
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(body).toString(),
  });
  const json = await res.json();
  if (!res.ok) throw new XeroAuthError(json.error_description || json.error || "xero_token_request_failed");
  return json;
}

export async function exchangeCodeForTokens(code) {
  return postTokenRequest({
    grant_type: "authorization_code",
    code,
    redirect_uri: process.env.XERO_REDIRECT_URI,
  });
}

export async function discoverTenant(accessToken) {
  const res = await fetch(CONNECTIONS_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new XeroAuthError("xero_connections_lookup_failed");
  const arr = await res.json();
  if (!arr.length) throw new XeroAuthError("no_tenant_authorised");
  return { tenant_id: arr[0].tenantId, tenant_name: arr[0].tenantName };
}

export async function saveConnection({ tokens, tenant, userId }) {
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
  await pool.query(
    `INSERT INTO xero_connection (id, tenant_id, tenant_name, access_token, refresh_token, token_expiry, connected_by, connected_at, updated_at)
     VALUES (1, $1, $2, $3, $4, $5, $6, NOW(), NOW())
     ON CONFLICT (id) DO UPDATE
       SET tenant_id     = EXCLUDED.tenant_id,
           tenant_name   = EXCLUDED.tenant_name,
           access_token  = EXCLUDED.access_token,
           refresh_token = EXCLUDED.refresh_token,
           token_expiry  = EXCLUDED.token_expiry,
           connected_by  = EXCLUDED.connected_by,
           connected_at  = EXCLUDED.connected_at,
           updated_at    = NOW()`,
    [tenant.tenant_id, tenant.tenant_name, encryptToken(tokens.access_token), encryptToken(tokens.refresh_token), expiresAt, userId]
  );
}

export async function getConnection() {
  const { rows } = await pool.query(
    `SELECT c.*, u.name AS connected_by_name
       FROM xero_connection c
       LEFT JOIN users u ON u.id = c.connected_by
      WHERE c.id = 1`
  );
  return rows[0] || null;
}

export async function clearConnection() {
  await pool.query(`DELETE FROM xero_connection WHERE id = 1`);
}

export async function getValidXeroAccessToken() {
  const conn = await getConnection();
  if (!conn) throw new XeroNotConnectedError();

  const expiry = new Date(conn.token_expiry);
  if (expiry.getTime() > Date.now() + 60_000) {
    return { accessToken: decryptToken(conn.access_token), tenantId: conn.tenant_id };
  }

  let tokens;
  try {
    tokens = await postTokenRequest({
      grant_type: "refresh_token",
      refresh_token: decryptToken(conn.refresh_token),
    });
  } catch (err) {
    // Refresh failed — assume user revoked us in Xero. Clear the row.
    await clearConnection();
    throw new XeroAuthError("xero_auth_lost");
  }

  const newExpiry = new Date(Date.now() + tokens.expires_in * 1000);
  await pool.query(
    `UPDATE xero_connection
        SET access_token  = $1,
            refresh_token = $2,
            token_expiry  = $3,
            updated_at    = NOW()
      WHERE id = 1`,
    [encryptToken(tokens.access_token), encryptToken(tokens.refresh_token), newExpiry]
  );
  return { accessToken: tokens.access_token, tenantId: conn.tenant_id };
}
```

- [ ] **Step 2: Parse-check**

Run: `node --check packages/backend/src/services/xero-auth.js`
Expected: clean exit (no output).

- [ ] **Step 3: Commit**

```bash
git add packages/backend/src/services/xero-auth.js
git commit -m "feat(backend): add xero-auth service with OAuth + token refresh"
```

---

## Task 4: Xero invoicing service (contacts + invoices)

**Files:**
- Create: `packages/backend/src/services/xero.js`

- [ ] **Step 1: Write the service module**

Path: `packages/backend/src/services/xero.js`

```js
import { pool } from "../config/db.js";
import { getValidXeroAccessToken } from "./xero-auth.js";

const XERO_API = "https://api.xero.com/api.xro/2.0";

export class XeroApiError extends Error {
  constructor(status, message, body) {
    super(message);
    this.name = "XeroApiError";
    this.status = status;
    this.body = body;
  }
}

async function xeroFetch(path, init = {}, attempt = 1) {
  const { accessToken, tenantId } = await getValidXeroAccessToken();
  const res = await fetch(`${XERO_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Xero-tenant-id": tenantId,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });

  if (res.status === 429 && attempt === 1) {
    await new Promise((r) => setTimeout(r, 1000));
    return xeroFetch(path, init, 2);
  }

  const text = await res.text();
  const body = text ? safeJson(text) : null;
  if (!res.ok) throw new XeroApiError(res.status, body?.Detail || body?.Title || `xero_${res.status}`, body);
  return body;
}

function safeJson(s) { try { return JSON.parse(s); } catch { return { raw: s }; } }

function escapeQuoted(name) {
  return name.replace(/"/g, '\\"');
}

export async function searchContactsByName(name) {
  const where = `Name=="${escapeQuoted(name)}"`;
  const path = `/Contacts?where=${encodeURIComponent(where)}`;
  const json = await xeroFetch(path);
  return (json?.Contacts || []).map((c) => ({
    contact_id: c.ContactID,
    name: c.Name,
    email: c.EmailAddress || null,
  }));
}

export async function searchContactsLike(searchText) {
  // Free-text search used by the admin "link provider to Xero contact" UI.
  const path = `/Contacts?searchTerm=${encodeURIComponent(searchText)}`;
  const json = await xeroFetch(path);
  return (json?.Contacts || []).map((c) => ({
    contact_id: c.ContactID,
    name: c.Name,
    email: c.EmailAddress || null,
  }));
}

export async function createContact({ name, email }) {
  const json = await xeroFetch("/Contacts", {
    method: "POST",
    body: JSON.stringify({
      Contacts: [{ Name: name, EmailAddress: email || undefined }],
    }),
  });
  const c = json?.Contacts?.[0];
  return { contact_id: c.ContactID, name: c.Name, email: c.EmailAddress || null };
}

function buildInvoiceDescription({ trainingName, candidateName, startDate, endDate }) {
  const dates = [startDate, endDate].filter(Boolean).join(" to ");
  return [trainingName, candidateName, dates].filter(Boolean).join(" — ");
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
function plusDaysIso(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function createDraftInvoice({
  contactId, description, quantity, unitPrice, currencyCode = "AUD",
}) {
  const accountCode = process.env.XERO_REVENUE_ACCOUNT_CODE || "200";
  const json = await xeroFetch("/Invoices", {
    method: "POST",
    body: JSON.stringify({
      Type: "ACCREC",
      Contact: { ContactID: contactId },
      Date: todayIso(),
      DueDate: plusDaysIso(30),
      LineAmountTypes: "Exclusive",
      Status: "DRAFT",
      CurrencyCode: currencyCode,
      LineItems: [{
        Description: description,
        Quantity: quantity,
        UnitAmount: unitPrice,
        AccountCode: accountCode,
      }],
    }),
  });
  const inv = json?.Invoices?.[0];
  return {
    xero_invoice_id:     inv.InvoiceID,
    xero_invoice_number: inv.InvoiceNumber || null,
    total_amount:        inv.Total ?? null,
    currency_code:       inv.CurrencyCode || currencyCode,
    raw:                 inv,
  };
}

export async function recordInvoice({
  candidate_training_id, xero_invoice_id, xero_invoice_number, xero_contact_id,
  status = "DRAFT", total_amount, currency_code, xero_response, created_by,
}) {
  const { rows } = await pool.query(
    `INSERT INTO xero_invoices (candidate_training_id, xero_invoice_id, xero_invoice_number, xero_contact_id, status, total_amount, currency_code, xero_response, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [candidate_training_id, xero_invoice_id, xero_invoice_number, xero_contact_id, status, total_amount, currency_code, xero_response, created_by]
  );
  return rows[0];
}

export async function listInvoicesForEnrolment(candidateTrainingId) {
  const { rows } = await pool.query(
    `SELECT * FROM xero_invoices WHERE candidate_training_id = $1 ORDER BY created_at DESC`,
    [candidateTrainingId]
  );
  return rows;
}

export { buildInvoiceDescription };
```

- [ ] **Step 2: Parse-check**

Run: `node --check packages/backend/src/services/xero.js`
Expected: clean exit.

- [ ] **Step 3: Commit**

```bash
git add packages/backend/src/services/xero.js
git commit -m "feat(backend): add xero service for contacts and invoice creation"
```

---

## Task 5: Xero router + app.js mount

**Files:**
- Create: `packages/backend/src/routes/xero.js`
- Modify: `packages/backend/src/app.js`

- [ ] **Step 1: Write the router**

Path: `packages/backend/src/routes/xero.js`

```js
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
```

- [ ] **Step 2: Mount in `app.js`**

Open `packages/backend/src/app.js`. Add the import near the other route imports (after `import { trainingsRouter }`):

```js
import { xeroRouter } from "./routes/xero.js";
```

And the mount, after the `/api/trainings` line:

```js
app.use("/api/xero", xeroRouter);
```

- [ ] **Step 3: Parse-check**

Run: `node --check packages/backend/src/routes/xero.js && node --check packages/backend/src/app.js`
Expected: clean exit.

- [ ] **Step 4: Verify the existing backend test suite still passes (no regressions)**

Run: `cd packages/backend && npm test`
Expected: all suites still pass (no new tests in this plan).

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/routes/xero.js packages/backend/src/app.js
git commit -m "feat(backend): add /api/xero routes for connection, contacts, invoices"
```

---

## Task 6: Allow `xero_contact_id` on `PUT /api/providers/:id`

**Files:**
- Modify: `packages/backend/src/routes/providers.js`

The existing handler is `PUT /:id` (line 91) — not PATCH. It already supports
partial updates via `COALESCE($N, column)` so we just need to extend its
whitelist with the new column.

- [ ] **Step 1: Extend the `PUT /:id` handler**

Open `packages/backend/src/routes/providers.js`. Around line 91-117, replace:

```js
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
```

with:

```js
providersRouter.put("/:id", requireRole("admin", "recruiter_admin"), async (req, res, next) => {
  try {
    const { name, contact_name, email, phone, address, is_active, xero_contact_id } = req.body;

    // xero_contact_id is a special case: callers may pass `null` to UNLINK,
    // which COALESCE would treat as "keep existing". So we branch on whether
    // the key is explicitly present in req.body.
    const xeroProvided = Object.prototype.hasOwnProperty.call(req.body, "xero_contact_id");
    const xeroSql      = xeroProvided ? "xero_contact_id = $8" : "xero_contact_id = xero_contact_id";

    const { rows } = await pool.query(
      `UPDATE providers
       SET name        = COALESCE($1, name),
           contact_name= COALESCE($2, contact_name),
           email       = COALESCE($3, email),
           phone       = COALESCE($4, phone),
           address     = COALESCE($5, address),
           is_active   = COALESCE($6, is_active),
           ${xeroSql},
           updated_at  = NOW()
       WHERE id = $7 RETURNING *`,
      xeroProvided
        ? [name, contact_name, email, phone, address, is_active, req.params.id, xero_contact_id]
        : [name, contact_name, email, phone, address, is_active, req.params.id]
    );
```

Leave the rest of the handler (404 check, activity_log insert, response) untouched.

- [ ] **Step 2: Parse-check**

Run: `node --check packages/backend/src/routes/providers.js`
Expected: clean exit.

- [ ] **Step 3: Smoke test via psql to confirm column persists**

Run:
```
psql "$DATABASE_URL" -c "UPDATE providers SET xero_contact_id='test-id' WHERE id=(SELECT id FROM providers LIMIT 1) RETURNING name, xero_contact_id;"
psql "$DATABASE_URL" -c "UPDATE providers SET xero_contact_id=NULL WHERE xero_contact_id='test-id';"
```
Expected: first command updates one row; second cleans up.

- [ ] **Step 4: Commit**

```bash
git add packages/backend/src/routes/providers.js
git commit -m "feat(backend): allow xero_contact_id on PUT /api/providers/:id"
```

---

## Task 7: Frontend Xero types

**Files:**
- Modify: `packages/frontend/src/types/index.ts`

- [ ] **Step 1: Append Xero types**

Open `packages/frontend/src/types/index.ts`. After the existing Training/CandidateTraining types, append:

```ts
export interface XeroConnection {
  tenant_id: string;
  tenant_name: string | null;
  connected_by_name: string | null;
  connected_at: string;
}

export interface XeroContact {
  contact_id: string;
  name: string;
  email: string | null;
}

export interface XeroInvoiceRow {
  id: string;
  candidate_training_id: string;
  xero_invoice_id: string;
  xero_invoice_number: string | null;
  xero_contact_id: string;
  status: string;
  total_amount: string | null;     // pg numerics come back as strings
  currency_code: string;
  created_by: string | null;
  created_at: string;
}
```

- [ ] **Step 2: Type-check**

Run: `cd packages/frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/src/types/index.ts
git commit -m "feat(frontend): add Xero types"
```

---

## Task 8: Frontend Xero hooks

**Files:**
- Create: `packages/frontend/src/hooks/useXero.ts`

- [ ] **Step 1: Write the hook file**

Path: `packages/frontend/src/hooks/useXero.ts`

```ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { XeroConnection, XeroContact, XeroInvoiceRow } from "../types";

export function useXeroConnection() {
  return useQuery({
    queryKey: ["xero-connection"],
    queryFn:  () => api.get<XeroConnection | null>("/xero/connection"),
  });
}

export function useXeroAuthUrl() {
  return useMutation({
    mutationFn: () => api.get<{ url: string }>("/xero/auth-url"),
  });
}

export function useDisconnectXero() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete("/xero/connection"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["xero-connection"] }),
  });
}

export function useXeroContactSearch(search: string) {
  return useQuery({
    queryKey: ["xero-contacts", search],
    queryFn:  () => api.list<XeroContact>(`/xero/contacts?search=${encodeURIComponent(search)}`),
    enabled:  search.trim().length > 0,
  });
}

export function useCreateXeroContact() {
  return useMutation({
    mutationFn: (body: { name: string; email?: string | null }) =>
      api.post<XeroContact>("/xero/contacts", body),
  });
}

export function useLinkProviderToXero() {
  const qc = useQueryClient();
  return useMutation({
    // Providers uses PUT /:id (with COALESCE for partial updates), not PATCH.
    mutationFn: ({ providerId, xero_contact_id }: { providerId: string; xero_contact_id: string | null }) =>
      api.put(`/providers/${providerId}`, { xero_contact_id }),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["providers"] });
      qc.invalidateQueries({ queryKey: ["provider", vars.providerId] });
    },
  });
}

export interface GenerateInvoicePayload {
  candidate_training_id: string;
  unit_price: number;
  quantity?: number;
  xero_contact_id?: string;
}

export interface AmbiguousContactResponse {
  candidates: XeroContact[];
}

export function useGenerateXeroInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: GenerateInvoicePayload) =>
      api.post<XeroInvoiceRow>("/xero/invoices", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["xero-invoices"] });
      qc.invalidateQueries({ queryKey: ["candidate-trainings"] });
      qc.invalidateQueries({ queryKey: ["candidate-trainings-list"] });
    },
  });
}

export function useXeroInvoicesForEnrolment(candidateTrainingId: string | undefined) {
  return useQuery({
    queryKey: ["xero-invoices", candidateTrainingId],
    queryFn:  () => api.list<XeroInvoiceRow>(`/xero/invoices?candidate_training_id=${candidateTrainingId}`),
    enabled:  !!candidateTrainingId,
  });
}
```

- [ ] **Step 2: Type-check**

Run: `cd packages/frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/src/hooks/useXero.ts
git commit -m "feat(frontend): add useXero hooks for connection, contacts, invoices"
```

---

## Task 9: Admin Xero connection page

**Files:**
- Create: `packages/frontend/src/pages/AdminXero.tsx`
- Modify: `packages/frontend/src/App.tsx`

- [ ] **Step 1: Write the page**

Path: `packages/frontend/src/pages/AdminXero.tsx`

```tsx
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CheckCircle2, AlertTriangle, Plug } from "lucide-react";
import {
  useXeroConnection, useXeroAuthUrl, useDisconnectXero,
} from "../hooks/useXero";
import { format } from "date-fns";

export default function AdminXero() {
  const [params, setParams] = useSearchParams();
  const { data: conn, isLoading } = useXeroConnection();
  const authUrl = useXeroAuthUrl();
  const disconnect = useDisconnectXero();
  const [banner, setBanner] = useState<string | null>(null);

  useEffect(() => {
    if (params.get("connected") === "true") {
      setBanner("Successfully connected to Xero.");
      const next = new URLSearchParams(params); next.delete("connected"); setParams(next, { replace: true });
    }
    const err = params.get("error");
    if (err) {
      setBanner(`Xero connect failed: ${err}`);
      const next = new URLSearchParams(params); next.delete("error"); setParams(next, { replace: true });
    }
  }, [params, setParams]);

  function handleConnect() {
    authUrl.mutateAsync().then((res) => { window.location.href = res.url; });
  }

  function handleDisconnect() {
    if (!confirm("Disconnect MyATS from Xero? Existing invoice records stay in MyATS.")) return;
    disconnect.mutate();
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">Xero</h1>
        <p className="text-sm text-slate-500 mt-0.5">Manage the MyATS connection to Xero for invoicing.</p>
      </div>

      {banner && (
        <div className="mb-4 flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-sm text-blue-800">
          <AlertTriangle size={14} className="mt-0.5" />
          <span>{banner}</span>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm p-5">
        {isLoading ? (
          <p className="text-sm text-slate-500">Loading...</p>
        ) : conn ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-green-600" />
              <h2 className="font-semibold text-slate-900">Connected</h2>
            </div>
            <dl className="text-sm text-slate-600 space-y-1 mt-2">
              <div className="flex"><dt className="w-32 text-slate-400">Tenant</dt><dd>{conn.tenant_name || conn.tenant_id}</dd></div>
              <div className="flex"><dt className="w-32 text-slate-400">Connected by</dt><dd>{conn.connected_by_name || "—"}</dd></div>
              <div className="flex"><dt className="w-32 text-slate-400">Connected at</dt><dd>{format(new Date(conn.connected_at), "PPpp")}</dd></div>
            </dl>
            <div className="mt-4">
              <button
                onClick={handleDisconnect}
                className="text-xs text-red-600 hover:underline"
              >
                Disconnect
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3 text-center py-6">
            <Plug className="mx-auto text-slate-400" />
            <h2 className="font-semibold text-slate-900">Not connected</h2>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              Connect MyATS to a Xero organisation to generate invoices from training enrolments.
              You'll need admin access on the Xero side.
            </p>
            <button
              onClick={handleConnect}
              disabled={authUrl.isPending}
              className="mt-2 px-4 py-2 text-sm rounded-lg bg-slate-800 text-white hover:bg-slate-900 disabled:opacity-50"
            >
              {authUrl.isPending ? "Loading..." : "Connect to Xero"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Register the route and nav link**

Open `packages/frontend/src/App.tsx`.

Add the import alongside other admin pages:

```tsx
import AdminXero        from "./pages/AdminXero";
```

Find the existing admin nav cluster (where Trainings was added previously). Insert a Xero link in the same admin-gated block:

```tsx
<NavLink to="/admin/xero"        className={navClass}>Xero</NavLink>
```

Add the route alongside the other admin routes:

```tsx
<Route path="/admin/xero"        element={<AdminRoute><AdminXero       /></AdminRoute>} />
```

- [ ] **Step 3: Type-check**

Run: `cd packages/frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/src/pages/AdminXero.tsx packages/frontend/src/App.tsx
git commit -m "feat(frontend): add Admin > Xero connection page"
```

---

## Task 10: GenerateInvoiceDialog component

**Files:**
- Modify: `packages/frontend/src/lib/api.ts`
- Create: `packages/frontend/src/components/training/GenerateInvoiceDialog.tsx`

The dialog needs to read the `data: { candidates }` payload that the backend
sends with a 409 disambiguation response. Today the fetch wrapper in
`lib/api.ts` throws `new Error(json.error)` and discards `data` — so we
need to attach the full response body to the error first.

- [ ] **Step 1: Extend `lib/api.ts` to attach response body to thrown errors**

Open `packages/frontend/src/lib/api.ts`. Replace the existing `request<T>` function:

```ts
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...options.headers,
    },
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || "Request failed");
  }
  return json.data as T;
}
```

with:

```ts
export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body  = body;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...options.headers,
    },
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new ApiError(res.status, json.error || "Request failed", json);
  }
  return json.data as T;
}
```

Verify: `cd packages/frontend && npx tsc --noEmit` — no errors. Existing
callers throw and catch `Error`; `ApiError extends Error` so they still work.

- [ ] **Step 2: Write the dialog**

Path: `packages/frontend/src/components/training/GenerateInvoiceDialog.tsx`

```tsx
import { useState } from "react";
import { useGenerateXeroInvoice } from "../../hooks/useXero";
import { ApiError } from "../../lib/api";
import type { CandidateTraining, XeroContact } from "../../types";

interface Props {
  enrolment: CandidateTraining & { candidate_name?: string };
  candidateName: string;
  defaultUnitPrice: number | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function GenerateInvoiceDialog({ enrolment, candidateName, defaultUnitPrice, onClose, onSuccess }: Props) {
  const [unitPrice, setUnitPrice] = useState<string>(defaultUnitPrice?.toString() ?? "");
  const [quantity, setQuantity] = useState<string>("1");
  const [error, setError] = useState("");
  const [disambiguation, setDisambiguation] = useState<XeroContact[] | null>(null);

  const generate = useGenerateXeroInvoice();

  const description =
    `${enrolment.training_name}${candidateName ? ` — ${candidateName}` : ""}` +
    `${enrolment.start_date ? ` — ${enrolment.start_date}` : ""}` +
    `${enrolment.end_date ? ` to ${enrolment.end_date}` : ""}`;

  function submit(xeroContactId?: string) {
    setError("");
    if (!unitPrice) { setError("Unit price is required."); return; }
    generate.mutateAsync({
      candidate_training_id: enrolment.id,
      unit_price: Number(unitPrice),
      quantity:   Number(quantity || 1),
      xero_contact_id: xeroContactId,
    }).then(() => onSuccess())
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 409) {
          const body = err.body as { data?: { candidates?: XeroContact[] } };
          const candidates = body?.data?.candidates;
          if (Array.isArray(candidates)) { setDisambiguation(candidates); return; }
        }
        setError(err instanceof Error ? err.message : "Failed to generate invoice");
      });
  }

  if (disambiguation) {
    return (
      <Backdrop onClose={onClose}>
        <h2 className="text-lg font-semibold text-slate-900 mb-2">Pick a Xero contact</h2>
        <p className="text-sm text-slate-500 mb-3">Multiple Xero contacts match this provider name. Pick the right one — we'll cache the choice so you only do this once per provider.</p>
        <div className="border border-slate-100 rounded-lg divide-y divide-slate-100 max-h-64 overflow-y-auto mb-4">
          {disambiguation.length === 0 ? (
            <p className="p-4 text-xs text-slate-400">No Xero contact found by that name.</p>
          ) : disambiguation.map((c) => (
            <button
              key={c.contact_id}
              type="button"
              onClick={() => { setDisambiguation(null); submit(c.contact_id); }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50"
            >
              <div className="text-slate-900">{c.name}</div>
              {c.email && <div className="text-xs text-slate-400">{c.email}</div>}
            </button>
          ))}
        </div>
        <div className="flex justify-end">
          <button onClick={() => setDisambiguation(null)} className="px-4 py-2 text-sm rounded-lg border border-slate-200 hover:bg-slate-50">Back</button>
        </div>
      </Backdrop>
    );
  }

  return (
    <Backdrop onClose={onClose}>
      <h2 className="text-lg font-semibold text-slate-900 mb-4">Generate invoice (DRAFT)</h2>
      <dl className="text-sm text-slate-600 space-y-1 mb-4">
        <div className="flex"><dt className="w-28 text-slate-400">Candidate</dt><dd className="text-slate-900">{candidateName}</dd></div>
        <div className="flex"><dt className="w-28 text-slate-400">Course</dt><dd>{enrolment.training_name}</dd></div>
        <div className="flex"><dt className="w-28 text-slate-400">Dates</dt><dd>{enrolment.start_date ?? "—"} → {enrolment.end_date ?? "—"}</dd></div>
      </dl>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="text-xs text-slate-500">Unit price (AUD) *</label>
          <input type="number" step="0.01" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-xs text-slate-500">Quantity</label>
          <input type="number" min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
        </div>
      </div>
      <div className="mb-3 text-xs text-slate-500">
        Description preview: <span className="text-slate-700">{description}</span>
      </div>
      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-slate-200 hover:bg-slate-50">Cancel</button>
        <button onClick={() => submit()} disabled={generate.isPending}
          className="px-4 py-2 text-sm rounded-lg bg-slate-800 text-white hover:bg-slate-900 disabled:opacity-50">
          {generate.isPending ? "Generating..." : "Generate invoice"}
        </button>
      </div>
    </Backdrop>
  );
}

function Backdrop({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Type-check**

Run: `cd packages/frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/src/lib/api.ts packages/frontend/src/components/training/GenerateInvoiceDialog.tsx
git commit -m "feat(frontend): add GenerateInvoiceDialog with disambiguation flow"
```

---

## Task 11: Wire the dialog into Candidate Detail + Enrolments tab

**Files:**
- Modify: `packages/frontend/src/pages/CandidateDetail.tsx`
- Modify: `packages/frontend/src/components/training/EnrolmentsTab.tsx`

- [ ] **Step 1: Wire into Candidate Detail's Training panel**

Open `packages/frontend/src/pages/CandidateDetail.tsx`. In the `TrainingTab` function, add imports near the top of the file (alongside the existing component imports):

```tsx
import { GenerateInvoiceDialog } from "../components/training/GenerateInvoiceDialog";
import { useXeroInvoicesForEnrolment } from "../hooks/useXero";
```

Inside `TrainingTab`, alongside the existing dialog-state hooks, add:

```tsx
const [invoicingEnrolment, setInvoicingEnrolment] = useState<CandidateTraining | null>(null);
```

Look at the existing actions cell in the enrolment table (the cell that already renders the "Edit" button). Add a sibling action that switches based on whether an invoice exists.

For each row, fetch invoice state via a new tiny inline component. Add this component at the bottom of the file:

```tsx
function InvoiceCell({ enrolment, onGenerate }: { enrolment: CandidateTraining; onGenerate: (e: CandidateTraining) => void }) {
  const { data } = useXeroInvoicesForEnrolment(enrolment.id);
  const existing = data?.data?.[0];
  if (existing) {
    return (
      <a href={`https://invoicing.xero.com/edit/${existing.xero_invoice_id}`} target="_blank" rel="noreferrer"
         className="text-xs text-blue-600 hover:underline">
        View in Xero
      </a>
    );
  }
  return (
    <button onClick={() => onGenerate(enrolment)} className="text-xs text-slate-500 hover:underline">
      Generate invoice
    </button>
  );
}
```

In the row JSX, insert a new `<td>` next to the existing edit action:

```tsx
<td className="px-4 py-2.5 text-right">
  <InvoiceCell enrolment={e} onGenerate={setInvoicingEnrolment} />
</td>
```

(If you prefer to keep Edit and Invoice in the same cell, render them inline with a small gap — match the existing visual style of the page.)

Then, at the bottom of `TrainingTab`'s JSX (where dialogs are already rendered), add:

```tsx
{invoicingEnrolment && (
  <GenerateInvoiceDialog
    enrolment={invoicingEnrolment}
    candidateName={candidate?.name ?? ""}
    defaultUnitPrice={null /* per-candidate panel doesn't have catalogue price handy; passing null is fine */}
    onClose={() => setInvoicingEnrolment(null)}
    onSuccess={() => setInvoicingEnrolment(null)}
  />
)}
```

If `defaultUnitPrice` needs to come from the catalogue, fetch it via the existing `useTrainings` data already loaded by the dialog above for the course-selector. For now, passing `null` is acceptable — the user types the price.

- [ ] **Step 2: Wire into the cross-candidate Enrolments tab**

Open `packages/frontend/src/components/training/EnrolmentsTab.tsx`. Add the same imports near the top:

```tsx
import { useState } from "react";   // (verify it's already imported)
import { GenerateInvoiceDialog } from "./GenerateInvoiceDialog";
import { useXeroInvoicesForEnrolment } from "../../hooks/useXero";
```

Add the same `invoicingEnrolment` state at the top of the component. Add the same `InvoiceCell` component (you may copy/paste from CandidateDetail — small enough to inline; if you want, extract into its own file `InvoiceCell.tsx` in `components/training/`).

In the row JSX, add a new `<td>` with the InvoiceCell. For `defaultUnitPrice`, fetch the corresponding `Training` from the `useTrainings({ isActive: true, limit: 200 })` data (the trainings catalogue is already loaded for the filter combobox). Look up the price by `training_id`:

```tsx
const priceByTrainingId = new Map(trainings.map((t) => [t.id, t.unit_price]));
// ... later, when opening the dialog:
defaultUnitPrice={priceByTrainingId.get(invoicingEnrolment.training_id) ?? null}
```

- [ ] **Step 3: Type-check + build**

Run: `cd packages/frontend && npx tsc --noEmit && npm run build`
Expected: no errors; build succeeds.

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/src/pages/CandidateDetail.tsx \
        packages/frontend/src/components/training/EnrolmentsTab.tsx
git commit -m "feat(frontend): wire GenerateInvoiceDialog into training rows"
```

---

## Task 12: Provider Detail Xero contact widget

**Files:**
- Modify: `packages/frontend/src/pages/ProviderDetail.tsx`

- [ ] **Step 1: Add the Xero contact widget**

Open `packages/frontend/src/pages/ProviderDetail.tsx`. Identify the header / sidebar area where provider metadata is shown (contact name, email, etc.).

Add imports:

```tsx
import { useState } from "react";
import { useXeroContactSearch, useCreateXeroContact, useLinkProviderToXero } from "../hooks/useXero";
import type { XeroContact } from "../types";
```

In the component, add a section near the provider metadata:

```tsx
function XeroContactSection({ provider }: { provider: { id: string; name: string; xero_contact_id: string | null } }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState(provider.name);
  const link = useLinkProviderToXero();
  const create = useCreateXeroContact();
  const { data: searchResult, isFetching } = useXeroContactSearch(open ? search : "");
  const matches = searchResult?.data ?? [];

  if (provider.xero_contact_id && !open) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="text-slate-500">Xero contact:</span>
        <code className="text-xs text-slate-700">{provider.xero_contact_id}</code>
        <button onClick={() => setOpen(true)} className="text-xs text-slate-400 hover:underline">change</button>
        <button onClick={() => link.mutate({ providerId: provider.id, xero_contact_id: null })}
                className="text-xs text-red-500 hover:underline">unlink</button>
      </div>
    );
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-xs text-slate-500 hover:underline">
        Link to Xero contact
      </button>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3 max-w-md">
      <div className="flex items-center gap-2 mb-2">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search Xero contacts..."
               className="flex-1 border border-slate-200 rounded px-2 py-1 text-sm" />
        <button onClick={() => setOpen(false)} className="text-xs text-slate-400 hover:underline">close</button>
      </div>
      {isFetching && <p className="text-xs text-slate-400">Searching...</p>}
      <ul className="divide-y divide-slate-100 max-h-48 overflow-y-auto">
        {matches.map((c: XeroContact) => (
          <li key={c.contact_id}>
            <button onClick={() => link.mutate({ providerId: provider.id, xero_contact_id: c.contact_id }, { onSuccess: () => setOpen(false) })}
                    className="w-full text-left px-2 py-1.5 text-sm hover:bg-slate-50">
              <div className="text-slate-900">{c.name}</div>
              {c.email && <div className="text-xs text-slate-400">{c.email}</div>}
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-2 pt-2 border-t border-slate-100">
        <button
          onClick={() => create.mutateAsync({ name: provider.name })
            .then((c) => link.mutateAsync({ providerId: provider.id, xero_contact_id: c.contact_id }))
            .then(() => setOpen(false))}
          disabled={create.isPending || link.isPending}
          className="text-xs text-blue-600 hover:underline disabled:opacity-50"
        >
          Create new Xero contact "{provider.name}"
        </button>
      </div>
    </div>
  );
}
```

Render `<XeroContactSection provider={provider} />` somewhere in the provider header/sidebar (alongside other contact fields).

- [ ] **Step 2: Type-check**

Run: `cd packages/frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/src/pages/ProviderDetail.tsx
git commit -m "feat(frontend): add Xero contact link widget to Provider Detail"
```

---

## Task 13: Final verification

- [ ] **Step 1: Backend test suite (regressions only — no new tests in this plan)**

Run: `cd packages/backend && npm test`
Expected: all existing suites pass. We didn't add tests in this plan per scope; verify nothing existing broke.

- [ ] **Step 2: Frontend type-check + build**

Run: `cd packages/frontend && npx tsc --noEmit && npm run build`
Expected: clean. Build succeeds.

- [ ] **Step 3: Set Railway env vars**

In the Railway dashboard for the `ats-platforms` (backend) service, add:
- `XERO_CLIENT_ID`
- `XERO_CLIENT_SECRET`
- `XERO_REDIRECT_URI`
- `XERO_SCOPES` (or leave unset — service falls back to default)
- `XERO_REVENUE_ACCOUNT_CODE` (optional — defaults to 200)

`TOKEN_ENCRYPTION_KEY` and `JWT_SECRET` should already be set.

- [ ] **Step 4: Manual smoke test on production**

1. Apply the migration to Railway: `psql "$RAILWAY_DATABASE_URL" -f database/013-xero-invoicing.sql`
2. Log in as admin.
3. Navigate to `/admin/xero` → click **Connect to Xero** → complete OAuth on Xero's side → return to MyATS, see "Connected" state with tenant name.
4. Open `/admin/trainings` and add a `unit_price` (e.g. 150.00) to one course.
5. Open a candidate that has an enrolment for that course (or create one) and click **Generate invoice** in the Training history row.
6. Confirm provider → Xero contact (auto-match or pick from disambiguation dialog).
7. Submit → row should change to **View in Xero**. Click it; verify a DRAFT invoice exists in Xero with the candidate name + dates in the line description.
8. Generate a second invoice for a different enrolment under the same provider — confirm no disambiguation prompt this time (the contact ID is cached on the provider).
9. Disconnect via `/admin/xero` to verify clean teardown.

- [ ] **Step 5: Decide on push**

Do not push automatically. Summarise what shipped, surface anything notable from the smoke test, and ask the user whether to push + open PR.

---

## Out of scope (explicit)

These are deliberately not part of this plan:

- Automated tests (`*.test.js`, `*.test.tsx`) — by user instruction.
- Status sync-back from Xero (DRAFT → AUTHORISED → PAID in MyATS).
- Webhook receivers for invoice events.
- AccountCode picker UI (currently env-driven).
- Bulk / batched invoicing (per-month-per-provider).
- Auto-generate on enrolment status change.
- Multi-tenant per-provider Xero OAuth.
- Credit notes / voiding from MyATS.
