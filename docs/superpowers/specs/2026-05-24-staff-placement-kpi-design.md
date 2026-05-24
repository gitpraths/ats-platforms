# Staff Placement KPI — Dashboard Leaderboard

**Date:** 2026-05-24
**Requested by:** Kev (Support Team)
**Priority:** High

---

## Context

Kev requested a placement KPI visible to both admins and individual staff. Admins want to see how many placements each recruiter has made. Individual staff want to see their own numbers. Currently the dashboard shows only aggregate placement counts with no staff breakdown.

---

## Goals

- Show placement counts per staff member on the dashboard
- Admins see all staff in a leaderboard ordered by total placements
- Individual staff see only their own row
- Show two figures per person: total placements (all time) and placements this month
- Highlight the logged-in user's row

---

## Architecture

The existing `GET /api/stats` endpoint is extended with a `placements_by_staff` array. No new route or hook is added — `useDashboardStats` already fetches this endpoint and the new field is included automatically.

The dashboard `Dashboard.tsx` renders a new leaderboard section below the existing KPI cards using the new data.

---

## Backend

### Change: `GET /api/stats`

**File:** `packages/backend/src/routes/stats.js`

A new parallel query is added to the existing `Promise.all` block:

```sql
SELECT
  u.id          AS user_id,
  u.name,
  COUNT(p.id)::int
    AS total_placements,
  COUNT(p.id) FILTER (
    WHERE DATE_TRUNC('month', p.created_at) = DATE_TRUNC('month', NOW())
  )::int AS placements_this_month
FROM users u
LEFT JOIN placements p ON p.created_by = u.id
WHERE u.role IN ('admin', 'recruiter_admin', 'recruiter')
GROUP BY u.id, u.name
ORDER BY total_placements DESC, u.name ASC
```

**Scoping:**
- Admin / recruiter_admin: full result set (all staff)
- All other roles: result filtered to `WHERE u.id = $currentUserId`

**Response addition:**

```json
{
  "placements_by_staff": [
    { "user_id": "uuid", "name": "Jane Harper", "total_placements": 12, "placements_this_month": 3 },
    { "user_id": "uuid", "name": "Mark Sullivan", "total_placements": 8, "placements_this_month": 1 }
  ]
}
```

---

## Frontend

### Change: `Dashboard.tsx`

**File:** `packages/frontend/src/pages/Dashboard.tsx`

A new "Placements by Staff" section is rendered below the existing KPI card rows.

#### Admin / recruiter_admin view — full leaderboard table

| Name | This Month | Total |
|------|-----------|-------|
| Jane Harper *(highlighted if current user)* | 3 | 12 |
| Mark Sullivan | 1 | 8 |

- Rows ordered by total descending (backend handles ordering)
- Logged-in user's row has a light blue background (`bg-blue-50`)
- A relative bar (thin coloured div, width proportional to `total / max_total`) sits inside the Total cell for visual scanning

#### Non-admin view — single row

Same table structure but only one row (their own). Labelled "Your Placements" as the section heading instead of "Placements by Staff".

#### No data state

If `placements_by_staff` is empty or missing, the section is not rendered.

---

## TypeScript

`useDashboardStats` return type is extended:

```typescript
placements_by_staff?: {
  user_id: string;
  name: string;
  total_placements: number;
  placements_this_month: number;
}[];
```

---

## What is not changing

- `GET /api/stats` response shape for all existing fields — untouched
- `useDashboardStats` hook — untouched (picks up new field automatically)
- All other dashboard sections — untouched
- No new routes, pages, or hooks
