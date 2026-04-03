# Task - Backend: Placements API

## Goal
Implement the placements API. A placement is created when a candidate is confirmed for a job with a start date set. It triggers welfare check generation.

## File
Create `packages/backend/src/routes/placements.js`
Register in `server.js` as `/api/placements`

## Endpoints

### GET /api/placements
- Returns paginated list of placements
- Query params: `?page=1&limit=20&employer_id=&provider_id=&job_id=&candidate_id=`
- Join: candidate name, job title, employer name, provider name
- Auth: all staff roles; `provider` role sees only their candidates' placements

### GET /api/placements/:id
- Returns single placement with full details
- Include candidate, job, employer, welfare_checks array
- Auth: staff + provider (scoped)

### POST /api/placements
- Create a placement
- Body: `{ application_id, candidate_id, job_id, employer_id, start_date, notes }`
- Validation: all required except `employer_id`, `notes`
- After insert: auto-generate 5 welfare check rows (day_1, week_1, month_1, month_3, month_6)
- Update application stage to `hired` if not already
- Update candidate `work_status` to `placed`
- Auth: `admin`, `recruiter_admin`, `recruiter`

### PUT /api/placements/:id
- Update `start_date`, `notes`, `confirmed_by_employer`, `employer_id`
- If `start_date` changes, recalculate and update all uncompleted welfare check due_dates
- Auth: `admin`, `recruiter_admin`, `recruiter`

### DELETE /api/placements/:id
- Hard delete (cascade deletes welfare checks)
- Revert candidate `work_status` to `job_seeking`
- Auth: `admin` only

### POST /api/placements/:id/send-confirmation
- Send employment confirmation email to employer contact
- Set `confirmation_sent_at` timestamp on placement
- Body: optional `{ message }` override
- Auth: `admin`, `recruiter_admin`, `recruiter`
- See prompt `0032-backend-email-service.md` for email service

## Response Shape
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "application_id": "...",
    "candidate_id": "...",
    "candidate_name": "...",
    "job_id": "...",
    "job_title": "...",
    "employer_id": "...",
    "employer_name": "...",
    "start_date": "2026-04-01",
    "confirmed_by_employer": false,
    "confirmation_sent_at": null,
    "notes": "...",
    "welfare_checks": [],
    "created_at": "...",
    "updated_at": "..."
  }
}
```

## Steps
- Welfare check generation logic: extract to `services/placement.js`
- Log placement created/updated to `activity_log` with `entity_type = 'placement'`
