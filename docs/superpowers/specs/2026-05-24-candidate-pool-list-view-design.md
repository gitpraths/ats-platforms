# Candidate Pool — List View Redesign

**Date:** 2026-05-24  
**Requested by:** Kev (Support Team)  
**Priority:** High — needed before live testing session

---

## Context

The current Candidates page renders a 3-column card grid with a hard limit of 20 records. With 300–400 candidates in the system this layout is not practical. Kev shared a Google Sheets reference showing how the team currently tracks candidates — a tabular view combining candidate info, placement data, and welfare check milestones in one screen.

---

## Goals

- Replace the card grid with a list (table) view as the default
- Keep the card view available via a toggle
- Add status-based tabs so staff can quickly filter to their working set
- Show placement and welfare check data inline — no need to navigate to the Placements page for the overview
- Support 300–400 candidates via server-side pagination

---

## Architecture

### Two-endpoint strategy

| Endpoint | Purpose | Changes |
|---|---|---|
| `GET /api/candidates` | Lightweight lookup — used by AssignTalentDialog, dropdowns, ProviderDetail | **Unchanged** |
| `GET /api/candidate-pool` | Rich pool view — powers the Candidates page only | **New** |

The Candidates page (`/candidates` route) is updated to call `/api/candidate-pool`. Everything else in the app that calls `/api/candidates` is untouched.

---

## Backend

### New endpoint: `GET /api/candidate-pool`

**File:** `packages/backend/src/routes/candidate-pool.js`  
**Registered in:** `packages/backend/src/app.js` as `/api/candidate-pool`  
**Auth:** `requireAuth` (all authenticated roles)

#### Query parameters

| Param | Values | Default |
|---|---|---|
| `tab` | `all`, `in_progress`, `placed`, `not_successful`, `inactive` | `all` |
| `page` | integer | `1` |
| `limit` | integer | `20` |
| `q` | search string (name, email, phone) | `""` |

#### Tab filtering

| Tab | SQL condition |
|---|---|
| `all` | no filter |
| `in_progress` | candidate has at least one application with `stage IN ('applied','screening','interview','offer')` — candidates with `work_status = 'job_seeking'` but no applications appear in `all` only |
| `placed` | `c.work_status = 'placed'` |
| `not_successful` | all applications are `rejected`, none active, `work_status != 'placed'` |
| `inactive` | `c.work_status = 'inactive'` |

#### Data returned per row

The main query uses LEFT JOINs to return in a single round-trip:

- **Candidate:** `id`, `name`, `email`, `phone`, `work_status`, `notes`, `training_start_date`, `training_end_date`
- **Provider:** `provider_name`, `provider_contact_name`, `provider_contact_email` (the "Consultant" column)
- **Latest placement** (subquery: most recent by `created_at`): `placement_id`, `start_date`, `confirmed_by_employer`, `employer_name`, `job_title`
- **Latest application** (subquery: most recent by `updated_at`): `latest_stage`, `latest_application_id`

Welfare checks are fetched in a second query after the main query, keyed by `placement_id`, and attached to each row — same pattern as the existing placements endpoint.

#### Tab counts

A second query (or CTE) returns `{all, in_progress, placed, not_successful, inactive}` counts for tab badge numbers.

#### Response shape

```json
{
  "success": true,
  "data": [...],
  "meta": {
    "total": 312,
    "page": 1,
    "limit": 20,
    "tab_counts": {
      "all": 312,
      "in_progress": 45,
      "placed": 180,
      "not_successful": 62,
      "inactive": 25
    }
  }
}
```

#### Training Dates migration

If `training_start_date` and `training_end_date` columns do not exist on the `candidates` table, a migration file `database/009-candidate-training-dates.sql` adds them as nullable `DATE` columns.

---

## Frontend

### Files changed

| File | Action |
|---|---|
| `packages/frontend/src/pages/Candidates.tsx` | Full replacement |
| `packages/frontend/src/hooks/useCandidatePool.ts` | New hook |

No other files are touched.

### Page structure

```
┌─────────────────────────────────────────────────────────┐
│ Candidates  (312)           [≡ List] [⊞ Card] [+ Add]   │
├─────────────────────────────────────────────────────────┤
│ 🔍 Search name, email, phone...                         │
├─────────────────────────────────────────────────────────┤
│ All(312) │ In Progress(45) │ Placed(180) │ Not Succ(62) │ Inactive(25) │
├─────────────────────────────────────────────────────────┤
│ TABLE / CARD CONTENT                                    │
├─────────────────────────────────────────────────────────┤
│ ← Previous   Page 1 of 16   Next →                     │
└─────────────────────────────────────────────────────────┘
```

### List view columns

| Column | Source | Notes |
|---|---|---|
| Name | `candidate.name` | Avatar initial + name; full row is clickable → `/candidates/:id` |
| Mobile | `candidate.phone` | — |
| Email | `candidate.email` | — |
| Provider | `provider_name` | — |
| Consultant | `provider_contact_name` + `provider_contact_email` | Two-line cell (name above, email below) |
| Status | `candidate.work_status` | Colour-coded badge (see below) |
| Comment | `candidate.notes` | Truncated to ~50 chars, full text on hover tooltip |
| Training Dates | `training_start_date` – `training_end_date` | Blank if not set |
| Job Start Date | `placement.start_date` | Blank if no placement |
| Employer | `employer_name` | Blank if no placement |
| Job Role | `job_title` (from placement) | Blank if no placement |
| Actions | View link + Email to Confirm button | "Email to Confirm" shown only when `work_status = 'placed'` and `confirmed_by_employer = false` |

#### Status badge colours

| Status | Colour |
|---|---|
| `placed` | Green |
| `job_seeking` / `in_progress` active applications | Amber |
| `not_successful` (all rejected) | Red |
| `inactive` | Grey |

### Welfare check sub-rows

For every candidate row that has a placement, a slim secondary row is rendered immediately below, spanning the full table width. It shows four milestone bands:

```
│ [ 4 Weeks ]  [ 8 Weeks ]  [ 12 Weeks ]  [ 26 Weeks ] │
```

Each band colour:

| State | Colour |
|---|---|
| `completed_at` is set | Green |
| `due_date` within next 7 days, not completed | Amber |
| `due_date` is past, not completed | Red |
| `due_date` is in the future (>7 days) | Grey |

Candidates without a placement render only the main row — no sub-row.  
Welfare sub-rows are not shown in card view.

### Card view

The existing card layout is preserved exactly as-is. Tabs and pagination apply in card view. No welfare sub-rows.

### View toggle persistence

The selected view (list or card) is stored in `localStorage` so it persists across page refreshes. Default is list.

### Pagination

- 20 records per page
- Previous / page number buttons / Next
- Changing tab resets to page 1
- Changing search resets to page 1

---

## What is not changing

- `GET /api/candidates` — untouched
- `useCandidates.ts` hook — untouched
- `CandidateDetail.tsx` — untouched
- `AssignTalentDialog.tsx` — untouched
- `ProviderDetail.tsx` — untouched
- Card view layout — preserved exactly
