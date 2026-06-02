# Xero Invoicing — Design Spec

**Date:** 2026-06-02
**Status:** Approved (design); implementation pending
**Delivery:** Single phase. No formal testing requirements in this spec — covered separately.

---

## 1. Purpose

Push training-enrolment invoices from MyATS to Xero so finance teams don't
re-key data. Each invoice is generated manually, one per enrolment, and lands
in Xero as a DRAFT for bookkeeper review.

Scope decisions baked in (from brainstorming, 2026-06-02):

- **Trigger:** manual button per enrolment. No auto-generate, no batching.
- **Xero scope:** ONE MyATS-wide Xero connection. All invoices flow to a
  single Xero tenant.
- **Provider → Xero contact:** auto-search by name on first invoice; admin
  confirms or creates if ambiguous; cached on the provider row.
- **Invoice shape:** one line item per enrolment. Description includes
  candidate name + start/end dates.
- **Pricing:** `unit_price` on the `trainings` catalogue, overridable at
  generate-time.
- **Status:** invoices created as **DRAFT** only.
- **Status sync-back:** none. MyATS stores the Xero invoice ID + number +
  link. Source of truth lives in Xero.

---

## 2. Data model

### 2.1 New column on `trainings`

```sql
ALTER TABLE trainings
  ADD COLUMN IF NOT EXISTS unit_price NUMERIC(10, 2);
```

Catalogue-level default price. Nullable so existing rows don't error. Edited
through the existing Admin > Trainings page (small UI addition).

### 2.2 New column on `providers`

```sql
ALTER TABLE providers
  ADD COLUMN IF NOT EXISTS xero_contact_id VARCHAR(36);
```

Cached after first successful link (auto-match or admin pick). Nullable
because not every provider needs invoicing.

### 2.3 New `xero_connection` table (singleton)

```sql
CREATE TABLE IF NOT EXISTS xero_connection (
  id              SERIAL PRIMARY KEY,
  tenant_id       VARCHAR(255) NOT NULL,
  tenant_name     VARCHAR(255),
  access_token    TEXT NOT NULL,            -- encrypted via TOKEN_ENCRYPTION_KEY
  refresh_token   TEXT NOT NULL,            -- encrypted
  token_expiry    TIMESTAMPTZ NOT NULL,
  connected_by    UUID REFERENCES users(id),
  connected_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

In practice the table holds 0 or 1 row. The "singleton at `id=1`" pattern is
established by upsert at the route layer (`ON CONFLICT (id) DO UPDATE`).
Encryption helpers come from the existing `ms-auth.js`:
`encryptToken`/`decryptToken` reuse `TOKEN_ENCRYPTION_KEY`.

### 2.4 New `xero_invoices` table

```sql
CREATE TABLE IF NOT EXISTS xero_invoices (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_training_id   UUID NOT NULL REFERENCES candidate_trainings(id) ON DELETE CASCADE,
  xero_invoice_id         VARCHAR(36)  NOT NULL,
  xero_invoice_number     VARCHAR(50),
  xero_contact_id         VARCHAR(36)  NOT NULL,
  status                  VARCHAR(20)  NOT NULL DEFAULT 'DRAFT',
  total_amount            NUMERIC(10, 2),
  currency_code           VARCHAR(3)   NOT NULL DEFAULT 'AUD',
  xero_response           JSONB,                  -- last successful raw response
  created_by              UUID REFERENCES users(id),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS xi_candidate_training_idx ON xero_invoices(candidate_training_id);
```

One row per invoice we successfully push. Multiple rows per enrolment are
allowed (re-invoicing, corrections) — the UI's "Generate invoice" button
hides itself when an unvoided row exists for the enrolment, but the schema
doesn't forbid more.

### 2.5 Migration

Single new file `database/013-xero-invoicing.sql` containing all four DDL
statements above (idempotent style — `IF NOT EXISTS` everywhere, matches
the 010 / 011 / 012 conventions).

---

## 3. OAuth flow

Mirrors the existing per-provider Microsoft Graph integration in
`packages/backend/src/services/ms-auth.js` and `routes/ms-auth.js`.

### 3.1 Environment variables

| Var | Purpose |
|---|---|
| `XERO_CLIENT_ID` | From the Xero developer portal app registration |
| `XERO_CLIENT_SECRET` | Same |
| `XERO_REDIRECT_URI` | E.g. `https://ats-platforms-production.up.railway.app/api/xero/callback` |
| `XERO_SCOPES` | `offline_access accounting.contacts accounting.transactions` |
| `XERO_REVENUE_ACCOUNT_CODE` | Defaults to `200` if unset. Xero's chart-of-accounts code for sales lines. |

### 3.2 Connect

1. Admin opens `/admin/xero`. Frontend calls `GET /api/xero/auth-url`.
2. Backend signs a `state` JWT with `{ userId }` and 10-min expiry
   (`JWT_SECRET` reused), returns the full Xero authorisation URL.
3. Browser redirects to Xero, admin signs in and approves.
4. Xero redirects back to `XERO_REDIRECT_URI` with `code` + `state`.
5. `GET /api/xero/callback` verifies the JWT state, POSTs the code to
   `https://identity.xero.com/connect/token` with the client creds, gets
   `access_token` + `refresh_token` + `expires_in`.
6. Backend calls `GET https://api.xero.com/connections` (with the new bearer)
   to discover the `tenant_id` and `tenant_name`. If multiple tenants come
   back, the first is used (the admin chose the org at Xero's consent screen).
7. Encrypts both tokens, upserts the singleton `xero_connection` row.
8. Redirects to `/admin/xero?connected=true`.

### 3.3 Token refresh

`services/xero-auth.js` exports `getValidXeroAccessToken()`:

- Reads the singleton row, decrypts the access token.
- If `token_expiry > now() + 60 seconds`, returns the cached token.
- Else POSTs the refresh token to `connect/token`, updates row, returns
  the new token.
- Throws `XeroNotConnectedError` if no row exists.
- Throws `XeroAuthError` if the refresh response is 4xx (i.e. the user
  revoked us in Xero — see §6).

### 3.4 Disconnect

`DELETE /api/xero/connection` clears the row. We do **not** call Xero's
revocation endpoint — the org admin can revoke at Xero's end if needed.
Existing `xero_invoices` rows are preserved as an audit trail.

---

## 4. Invoice generation flow

### 4.1 Entry points

Two row-action surfaces (added in this work):

- The **Candidate Detail → Training history** table (existing component).
- The **`/training` → Enrolments** tab table (existing component).

On each enrolment row, an action column shows:

- "Generate invoice" — when there's no `xero_invoices` row for that enrolment, and the current user is `admin` or `recruiter_admin`.
- "View in Xero" — when an `xero_invoices` row exists. Links to
  `https://invoicing.xero.com/edit/<xero_invoice_id>` in a new tab.

### 4.2 Dialog

`GenerateInvoiceDialog` (new file
`packages/frontend/src/components/training/GenerateInvoiceDialog.tsx`)
shows:

- Read-only summary: candidate name, training name, start/end dates.
- Provider name + Xero contact link state ("auto-linked", "needs
  confirmation", or "not yet linked").
- **Unit price** input, prefilled from `trainings.unit_price`, editable.
- **Quantity** input, default 1.
- Live description preview: `<Training name> — <Candidate name> — <start_date> to <end_date>`.
- Submit button: **Generate invoice (DRAFT)**.

### 4.3 Backend handler

`POST /api/xero/invoices`

```json
{
  "candidate_training_id": "uuid",
  "unit_price": 150.00,
  "quantity": 1,
  "xero_contact_id": "optional override after disambiguation"
}
```

Steps:

1. `requireRole("admin", "recruiter_admin")`.
2. Load the enrolment + candidate + training + provider in one join. 404
   if any missing.
3. Resolve the Xero contact for the provider:
   - If body has `xero_contact_id` → use it (this is the disambiguation
     resubmit path). Persist it on the provider row.
   - Else if `providers.xero_contact_id` is set → use it.
   - Else call
     `GET https://api.xero.com/api.xro/2.0/Contacts?where=Name=="<escaped name>"`
     - One match → cache it on the provider row, use it.
     - Zero or many → respond `409 { success: false, error: "ambiguous_xero_contact", candidates: [{ contact_id, name, email }] }`. Frontend re-opens with a disambiguation mini-dialog (see §4.4).
4. Build the Xero payload (`POST https://api.xero.com/api.xro/2.0/Invoices`):

   ```json
   {
     "Type": "ACCREC",
     "Contact": { "ContactID": "<resolved>" },
     "Date": "<today, YYYY-MM-DD>",
     "DueDate": "<today + 30 days, YYYY-MM-DD>",
     "LineAmountTypes": "Exclusive",
     "Status": "DRAFT",
     "LineItems": [
       {
         "Description": "<built description>",
         "Quantity":    <quantity>,
         "UnitAmount":  <unit_price>,
         "AccountCode": "<XERO_REVENUE_ACCOUNT_CODE, defaults to 200>"
       }
     ]
   }
   ```

   Required headers:
   - `Authorization: Bearer <from getValidXeroAccessToken()>`
   - `Xero-tenant-id: <from xero_connection.tenant_id>`
   - `Content-Type: application/json`

5. On 2xx:
   - Insert into `xero_invoices`, persisting the full raw response in
     `xero_response`.
   - Append `activity_log` row: `entity_type='candidate_training'`,
     `action='invoice_generated'`, `metadata={ xero_invoice_id, xero_invoice_number, total_amount }`.
   - Respond 201 with the new row.
6. On non-2xx: do NOT insert. Surface error per §6.

### 4.4 Disambiguation mini-dialog

When the backend responds 409 with a `candidates` list, the frontend
shows a small follow-up dialog over the existing form:

- List of Xero contacts found (name + email if present).
- "Create new Xero contact" option (calls `POST /api/xero/contacts`,
  then continues with the new ID).
- "Cancel" returns to the main dialog.

After the user picks, the frontend resubmits the original generate-invoice
request with `xero_contact_id` added. Server-side step 3 takes the
override path and persists the choice on the provider row.

---

## 5. API surface

All routes require `requireAuth` (router-level). Per-route role gates
listed below. Response envelope is the existing
`{ success, data }` / `{ success: false, error }`.

| Method | Path | Body / Query | Auth | Returns |
|---|---|---|---|---|
| `GET` | `/api/xero/auth-url` | — | admin | `{ url }` |
| `GET` | `/api/xero/callback` | `?code&state` | (state JWT proves origin) | redirect 302 |
| `GET` | `/api/xero/connection` | — | admin | `{ tenant_id, tenant_name, connected_by_name, connected_at }` or `null` |
| `DELETE` | `/api/xero/connection` | — | admin | `{ success: true }` |
| `GET` | `/api/xero/contacts` | `?search=<name>` | admin | `[{ contact_id, name, email }]` (proxies Xero search) |
| `POST` | `/api/xero/contacts` | `{ name, email? }` | admin | `{ contact_id, name }` |
| `POST` | `/api/xero/invoices` | see §4.3 | admin / recruiter_admin | new `xero_invoices` row (201) or 409 ambiguous |
| `GET` | `/api/xero/invoices` | `?candidate_training_id` | any authed | `xero_invoices` rows |

**Extension to existing route:** `PATCH /api/providers/:id` accepts
`xero_contact_id` as a new optional field on its whitelist.

### 5.1 Files

- `packages/backend/src/services/xero-auth.js` — OAuth + token refresh +
  encryption (mirrors `ms-auth.js`).
- `packages/backend/src/services/xero.js` — contact search/create, invoice
  create. Uses `fetch` (consistent with `ms-auth.js`).
- `packages/backend/src/routes/xero.js` — all `/api/xero/*` routes.
- Mounted in `app.js`: `app.use("/api/xero", xeroRouter)`.

---

## 6. Error handling

Five failure modes, surfaced consistently to the client so the UI can
react without needing to inspect strings.

| Cause | HTTP | `error` value | Frontend reaction |
|---|---|---|---|
| `xero_connection` row missing | 412 | `"xero_not_connected"` | Inline link to `/admin/xero` |
| Refresh-token call returns 4xx | 401 | `"xero_auth_lost"` | Toast warning + same link; also clears the row server-side |
| Xero API 5xx / network | 502 | Xero's raw error message | Inline error in the dialog, with a Retry button |
| Xero API 400 (validation) | 400 | Xero's raw error message | Same — usually points at AccountCode misconfig |
| Xero API 429 rate limit | 429 (after 1 silent retry) | `"rate_limited"` | Inline error suggesting a wait |

Notes:

- We do NOT auto-retry on 5xx or network errors. One try, surface, let
  the user decide.
- We DO retry once after 1 second on 429 (Xero's per-tenant limit is
  60/min — we should never hit it in normal use; this is just safety).
- Failures do NOT write to `activity_log`. Only successful invoice
  creates do.
- All errors go through `winston` at `error` level with the full Xero
  response body for debugging.

### 6.1 Audit trail

Every successful `xero_invoices` insert keeps the raw Xero response in
`xero_response` (JSONB). This is the canonical record of what Xero
acknowledged. If Xero's response format ever changes, or if a finance
team needs to reconcile a missing invoice, the JSONB has everything.

---

## 7. Out of scope (explicit)

These came up during brainstorming and are deliberately **not** part of
this spec. Each can be its own follow-up:

- **Status sync-back from Xero** (DRAFT → AUTHORISED → PAID in MyATS).
  Source of truth lives in Xero for now.
- **Webhook receivers** for invoice events.
- **AccountCode picker in the UI** (currently env-driven).
- **Bulk invoice generation** (e.g. monthly per provider).
- **Auto-generate on status change** (e.g. on completion).
- **Tax handling** beyond Xero's defaults (we send `LineAmountTypes: Exclusive`; Xero applies its configured tax rate).
- **Credit notes / voiding** from MyATS — done in Xero directly.
- **Multi-Xero-tenant** (per-provider OAuth). Single-tenant is the
  scoped decision.

---

## 8. Open items for the implementer

None blocking. Couple of small decisions the implementer will lock in
during the plan write-up:

- Whether the disambiguation mini-dialog is a separate component or
  inline state in `GenerateInvoiceDialog`.
- Naming nit: `XeroNotConnectedError` vs. `XeroNotConnected` (typed
  error class in `services/xero-auth.js`).

---
