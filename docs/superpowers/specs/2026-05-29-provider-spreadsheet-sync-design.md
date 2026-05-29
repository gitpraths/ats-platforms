# Provider Spreadsheet 2-Way Sync — Design Spec

**Date:** 2026-05-29  
**Status:** Approved  
**Feature:** Sync a provider's OneDrive Excel spreadsheet with ATS candidate data (2-way)

---

## Overview

Providers (workforce placement organisations) currently manage their candidate lists in an Excel spreadsheet on OneDrive — this predates the ATS. This feature connects the ATS to each provider's existing spreadsheet so that:

- **Inbound:** New/updated candidates in the spreadsheet are created or updated in the ATS
- **Outbound:** ATS data (pipeline stage, placement, welfare check, work status) is written back into the spreadsheet

The sync is manual — triggered by staff clicking "Sync Now" on the Provider Detail page.

---

## Architecture

```
Frontend (React)
  └── Provider Detail page
        ├── "Connect OneDrive" button  →  OAuth connect flow
        ├── "Sync Now" button          →  POST /api/providers/:id/sync
        └── Sync history panel        →  GET  /api/providers/:id/sync-logs

Backend (Express)
  ├── routes/ms-auth.js          ← new: OAuth URL generation + callback
  ├── routes/providers.js        ← extended: spreadsheet config + sync trigger
  ├── services/ms-auth.js        ← new: token exchange, refresh, revoke, AES-256 encrypt/decrypt
  └── services/spreadsheet.js   ← new: Graph API read/write, row parsing, conflict resolution

Microsoft Graph API
  └── Excel endpoints:
        GET  /me/drive/items/{file-id}/workbook/worksheets/{sheet}/usedRange
        PATCH /me/drive/items/{file-id}/workbook/worksheets/{sheet}/range(address=...)
```

---

## Authentication

**Approach:** Azure OAuth Authorization Code Flow (per-provider, delegated permissions)

**Azure App Registration (one-time setup):**
- Tenant: `common` (supports personal Microsoft accounts)
- Scopes: `Files.ReadWrite offline_access User.Read`
- Redirect URI: `https://<api-host>/api/ms-auth/callback`

**Connect flow:**
1. Staff clicks "Connect OneDrive" on Provider Detail page
2. Frontend calls `GET /api/providers/:id/ms-auth/url` — backend returns Microsoft OAuth URL with signed `state` JWT (contains `providerId` + `userId`, prevents CSRF)
3. Frontend redirects the current page to the Microsoft login URL (same window — no popup)
4. Microsoft redirects to `GET /api/ms-auth/callback?code=...&state=...`
5. Backend validates state JWT, exchanges code for tokens, encrypts with AES-256, stores on provider record
6. Backend redirects browser back to `<frontend-host>/providers/:id?connected=true`
7. Frontend shows file URL input form — staff pastes the OneDrive file URL
8. Backend resolves URL to Graph item ID via `GET /v1.0/me/drive/root:/path`, stores `onedrive_file_id` + `onedrive_sheet_name`

**Token refresh:** Before every sync, check `ms_token_expiry`. If expiring within 5 minutes, auto-refresh using stored refresh token. If refresh token is revoked, mark provider disconnected and prompt staff to reconnect.

**Disconnect:** `DELETE /api/providers/:id/ms-auth` — clears all `ms_*` columns, calls Microsoft `/revoke` endpoint.

**Environment variables required:**
```
AZURE_CLIENT_ID=
AZURE_CLIENT_SECRET=
AZURE_TENANT_ID=common
MS_REDIRECT_URI=https://<api-host>/api/ms-auth/callback
TOKEN_ENCRYPTION_KEY=   # 32-byte hex string for AES-256
```

---

## Database Changes

### `providers` table — new columns

```sql
ALTER TABLE providers
  ADD COLUMN ms_access_token      TEXT,
  ADD COLUMN ms_refresh_token     TEXT,
  ADD COLUMN ms_token_expiry      TIMESTAMPTZ,
  ADD COLUMN ms_user_email        VARCHAR(255),
  ADD COLUMN onedrive_file_id     VARCHAR(500),
  ADD COLUMN onedrive_sheet_name  VARCHAR(255) DEFAULT 'Sheet1',
  ADD COLUMN last_synced_at       TIMESTAMPTZ;
```

Tokens are stored AES-256 encrypted. `ms_user_email` records which Microsoft account is connected.

### `candidates` table — new column

```sql
ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS transport_type VARCHAR(20);
  -- values: car | public_transport | both | none
```

### New table: `provider_sync_logs`

```sql
CREATE TABLE provider_sync_logs (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_id          UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  triggered_by         UUID REFERENCES users(id) ON DELETE SET NULL,
  status               VARCHAR(20) NOT NULL,  -- success | partial | failed
  candidates_created   INTEGER DEFAULT 0,
  candidates_updated   INTEGER DEFAULT 0,
  rows_written_back    INTEGER DEFAULT 0,
  rows_skipped         INTEGER DEFAULT 0,
  error_message        TEXT,
  started_at           TIMESTAMPTZ DEFAULT NOW(),
  completed_at         TIMESTAMPTZ
);

CREATE INDEX idx_sync_logs_provider ON provider_sync_logs(provider_id);
```

---

## Spreadsheet Column Mapping

The provider's spreadsheet has these columns (existing, not to be changed):

| Spreadsheet Column | Direction | ATS Field |
|---|---|---|
| **Email** | Inbound — match key | `candidates.email` |
| **Jobseeker** | Inbound | `candidates.name` |
| **Mobile** | Inbound | `candidates.phone` |
| **Ideal Roles** | Inbound | `candidates.interested_job` |
| **Comments - experience, hours etc** | Inbound | `candidates.notes` (appended with timestamp) |
| **Wage sub - Max $ & hours** | Inbound | `candidates.wage_subsidy` + `candidates.wage_subsidy_amount` + `candidates.benchmark_hours` (parsed from text) |
| **Car or PT?** | Inbound | `candidates.transport_type` |
| **EC** | Inbound | Prepended to `candidates.notes` as metadata — not mapped to a user account |
| **Please refer to (EC Only)** | Read-only | Appended to notes on inbound — never overwritten on outbound |
| **Comments (EC Only)** | Read-only | Appended to notes on inbound — never overwritten on outbound |
| **Have referred to (WV Only)** | Read-only | Appended to notes on inbound — never overwritten on outbound |
| **Comments (WV Only)** | Read-only | Appended to notes on inbound — never overwritten on outbound |

The ATS appends four new columns at the right of the sheet on first outbound sync:

| New Column (ATS-owned) | Direction | ATS Source |
|---|---|---|
| **Work Status (ATS)** | Outbound | `candidates.work_status` |
| **Pipeline Stage (ATS)** | Outbound | Latest `applications.stage` for this candidate |
| **Placement (ATS)** | Outbound | `placements` — employer name + start date |
| **Welfare Check (ATS)** | Outbound | Latest completed `welfare_checks.check_type` |

---

## Sync Logic

### Trigger
`POST /api/providers/:id/sync` — admin or recruiter_admin only. Returns sync summary.

### Run sequence

1. Load provider — check tokens, refresh if needed
2. Call Graph API `usedRange` — get all rows as 2D array
3. Read header row — map column names to array positions (case-insensitive, trimmed)
4. For each data row:
   - **Skip** if email cell is empty — log as skipped
   - Look up `candidates WHERE email = row.email AND provider_id = provider.id`
   - **Found:** UPDATE `name`, `phone`, `interested_job`, `notes`, `wage_subsidy`, `wage_subsidy_amount`, `benchmark_hours`, `transport_type`
   - **Not found:** INSERT new candidate with `provider_id` set
   - Query latest application stage, placement, welfare check for this candidate
   - Collect outbound values for this row
5. PATCH ATS-owned columns back to spreadsheet in a single batch call
6. Write `provider_sync_logs` record
7. Update `providers.last_synced_at`

### Graph API write (targeted cell patch)

On each sync, the backend scans the header row for columns named exactly:
`"Work Status (ATS)"`, `"Pipeline Stage (ATS)"`, `"Placement (ATS)"`, `"Welfare Check (ATS)"`.

- If found: writes to those column positions
- If not found: appends them after the last existing column (first sync)

```
PATCH /me/drive/items/{file-id}/workbook/worksheets/{sheet}/range(address='{colStart}2:{colEnd}{lastRow}')
Body: { values: [[workStatus, stage, placement, welfareCheck], ...] }
```

Column letters are resolved dynamically from the header scan — never hardcoded. Only ATS-owned columns are touched. Provider columns are never modified.

### Conflict rules

| Situation | Rule |
|---|---|
| Spreadsheet name differs from ATS | Spreadsheet wins — ATS updated |
| Email matches candidate from a different provider | Skip row, log warning — never reassign provider |
| Row has no email | Skip row, log as skipped |
| Wage sub cell unparseable | Store raw text in notes, leave amount/hours unchanged |
| EC/WV-only columns | Read into notes on inbound, never touched on outbound |
| ATS-owned columns already present | Overwrite — ATS is source of truth for those columns |

---

## API Routes

### New file: `routes/ms-auth.js`

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/providers/:id/ms-auth/url` | recruiter_admin+ | Return Microsoft OAuth URL |
| `GET` | `/api/ms-auth/callback` | none (OAuth callback) | Exchange code for tokens, store encrypted, redirect to frontend |
| `DELETE` | `/api/providers/:id/ms-auth` | recruiter_admin+ | Disconnect — clear tokens, revoke with Microsoft |

### Extended: `routes/providers.js`

| Method | Path | Auth | Description |
|---|---|---|---|
| `PATCH` | `/api/providers/:id/spreadsheet` | recruiter_admin+ | Save OneDrive file ID + sheet name |
| `POST` | `/api/providers/:id/sync` | recruiter_admin+ | Trigger manual sync — returns sync summary |
| `GET` | `/api/providers/:id/sync-logs` | recruiter_admin+ | List past sync runs |

---

## Frontend UI

Changes are confined to the existing **Provider Detail page**. No new pages required.

### Connected state

```
┌─ Spreadsheet Sync ──────────────────────────────────────────┐
│                                                              │
│  Status: ● Connected  (jane@outlook.com)                     │
│  Last synced: 28 May 2026, 3:14 PM                          │
│                                                              │
│  [ Sync Now ]   [ Disconnect ]                              │
│                                                              │
│  ── Recent Syncs ──────────────────────────────────────────  │
│  28 May 3:14 PM   ✓ 3 created, 5 updated, 8 written back   │
│  27 May 9:00 AM   ✓ 0 created, 2 updated, 2 written back   │
│  26 May 2:30 PM   ✗ Failed — token expired, reconnect      │
└──────────────────────────────────────────────────────────────┘
```

### Not connected state

```
┌─ Spreadsheet Sync ──────────────────────────────────────────┐
│                                                              │
│  Status: ○ Not connected                                     │
│                                                              │
│  [ Connect OneDrive ]                                        │
│                                                              │
│  Clicking Connect will open Microsoft login in a new tab.   │
└──────────────────────────────────────────────────────────────┘
```

### After OAuth — file setup form

```
  OneDrive file URL:  [ paste URL here            ]
  Sheet name:         [ Sheet1                    ]
                      [ Save & Run First Sync     ]
```

---

## Error Handling

### Token errors

| Error | Behaviour |
|---|---|
| Access token expired | Auto-refresh before sync — transparent to user |
| Refresh token revoked | Mark provider disconnected, show "Reconnect" button in UI |
| OAuth state mismatch | Reject with 400, do not store tokens |

### Spreadsheet errors

| Error | Behaviour |
|---|---|
| File not found | Sync fails — log "Spreadsheet not found — check file ID" |
| Sheet name not found | Sync fails — log "Sheet not found — update sheet name in settings" |
| Header row missing expected columns | Sync fails — list missing columns in error message |
| Row missing email | Skip row — counted in sync log as skipped |
| Email matches different provider's candidate | Skip row — log as warning, never reassign |

### Runtime errors

| Error | Behaviour |
|---|---|
| Graph API rate limit | Retry once after 2 seconds, then fail gracefully |
| Partial row failures | Continue remaining rows, log status as `partial` |
| Database error mid-sync | Roll back all writes for that run, log as `failed` |

---

## Out of Scope

- Scheduled/automatic sync (manual only for now — can add cron trigger later with no architectural change)
- Multiple spreadsheets per provider
- Creating/deleting spreadsheet rows from the ATS
- Syncing candidate documents/CVs
- Provider self-service (providers cannot trigger sync — staff only)
