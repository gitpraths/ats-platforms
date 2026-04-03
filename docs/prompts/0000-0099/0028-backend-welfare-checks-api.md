# Task - Backend: Welfare Checks API

## Goal
Implement the welfare checks API. Welfare checks are milestone follow-ups after a candidate is placed, confirming the placement is ongoing.

## File
Add welfare check routes to `packages/backend/src/routes/placements.js` (sub-resource) or a dedicated `routes/welfare-checks.js`

## Endpoints

### GET /api/placements/:id/welfare-checks
- Returns all welfare checks for a placement, ordered by `due_date` ASC
- Include: `check_type`, `due_date`, `completed_at`, `employer_response`, `email_sent_at`
- Auth: all staff roles + provider (scoped to their candidates)

### PATCH /api/welfare-checks/:id
- Mark a welfare check complete
- Body: `{ employer_response, completed_at }` (`completed_at` defaults to NOW())
- Cannot un-complete a check
- Auth: `admin`, `recruiter_admin`, `recruiter`

### POST /api/welfare-checks/:id/send-email
- Send welfare check email to employer
- Sets `email_sent_at` on the check
- Auth: `admin`, `recruiter_admin`, `recruiter`
- See prompt `0032-backend-email-service.md` for email service

## Welfare Check Types
| check_type | Label            | Offset from start_date |
|------------|------------------|------------------------|
| day_1      | Day 1 Check      | +1 day                 |
| week_1     | Week 1 Check     | +7 days                |
| month_1    | 1 Month Check    | +1 month               |
| month_3    | 3 Month Check    | +3 months              |
| month_6    | 6 Month Check    | +6 months              |

## Response Shape
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "placement_id": "uuid",
    "check_type": "week_1",
    "due_date": "2026-04-08",
    "completed_at": null,
    "employer_response": null,
    "email_sent_at": null,
    "created_at": "..."
  }
}
```

## Steps
- Add index on `welfare_checks(due_date)` for cron queries (see prompt `0033`)
- Validate `check_type` is one of the 5 allowed values
- Return 400 if trying to PATCH an already-completed check
