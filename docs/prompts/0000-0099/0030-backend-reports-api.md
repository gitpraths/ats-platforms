# Task - Backend: Reports API

## Goal
Implement 3 report endpoints for the recruitment portal: provider-wise, placement tracking, and staff-wise.

## File
Create `packages/backend/src/routes/reports.js`
Register in `server.js` as `/api/reports`

## Auth
All report endpoints require auth. Role: `admin`, `recruiter_admin` only.

## Endpoints

### GET /api/reports/providers
Provider-wise candidate and placement summary.

Response data per provider:
```json
{
  "provider_id": "uuid",
  "provider_name": "...",
  "total_candidates": 20,
  "active_candidates": 15,
  "placed_candidates": 8,
  "job_seeking_candidates": 5,
  "inactive_candidates": 2,
  "placement_rate": "40%"
}
```

Query params: `?from=2026-01-01&to=2026-03-31`

### GET /api/reports/placements
All placements with welfare check completion status.

Response data per placement:
```json
{
  "placement_id": "uuid",
  "candidate_name": "...",
  "job_title": "...",
  "employer_name": "...",
  "provider_name": "...",
  "start_date": "2026-04-01",
  "confirmed_by_employer": false,
  "welfare_checks": {
    "day_1":   { "due_date": "...", "completed": false },
    "week_1":  { "due_date": "...", "completed": false },
    "month_1": { "due_date": "...", "completed": false },
    "month_3": { "due_date": "...", "completed": false },
    "month_6": { "due_date": "...", "completed": false }
  }
}
```

Query params: `?from=&to=&employer_id=&provider_id=`

### GET /api/reports/staff
Jobs and placements managed per recruiter/staff member.

Response data per staff member:
```json
{
  "user_id": "uuid",
  "user_name": "...",
  "role": "recruiter",
  "jobs_assigned": 5,
  "active_jobs": 3,
  "total_applications": 22,
  "total_placements": 6
}
```

Query params: `?from=&to=`

## Steps
- All queries use raw SQL with parameterised date filters (no ORM)
- Paginate results with `?page=1&limit=50`
- Return empty array (not 404) when no data matches filters
