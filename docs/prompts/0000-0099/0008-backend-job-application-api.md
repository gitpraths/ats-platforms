# Task - Job Application API

## Goal
Create CRUD endpoints for job applications and the hiring pipeline.

## POST /api/applications — Create Application
- Body: `{ job_id: uuid, candidate_id: uuid, source: string }`
- All fields required
- Application is ALWAYS created with `stage = 'applied'` and `score = 0`
- Returns: full application object

## PATCH /api/applications/:id — Update Application
- Body: `{ stage, score }` — both optional
- Valid stages: `applied | screening | interview | offer | hired | rejected`
- Only the job recruiter (job owner or assigned recruiter) may update
- Set `updated_at = now()`
- Returns: full updated application object

## DELETE /api/applications/:id — Delete Application
- Only the job recruiter may delete
- Returns: `{ id, status: "DELETED" }`

## GET /api/applications — Search Applications
- Optional query: `?candidate=string&job_title=string`
- Authorization: return ONLY applications where `req.user` is the recruiter
  - User is job owner (`jobs.created_by = req.user.id`) OR
  - User is in `job_recruiter` for that job
- Response shape per application:
```json
{
  "id": "...",
  "candidate_id": "...",
  "job_id": "...",
  "stage": "interview",
  "source": "linkedin",
  "score": 85,
  "created_at": "...",
  "updated_at": "...",
  "job": {
    "job_number": 1,
    "title": "Senior Software Engineer",
    "status": "published",
    "department": { "name": "Engineering" },
    "location": { "city": "Austin", "state": "TX", "is_remote": false }
  },
  "candidate": {
    "id": "...",
    "name": "John Doe",
    "email": "john@example.com",
    "city": "Austin",
    "state": "TX"
  },
  "recruiters": [
    { "id": "...", "name": "Jane Smith", "email": "jane@company.com" }
  ]
}
```

## Database Changes Needed
Add to `applications` table:
```sql
ALTER TABLE applications ADD COLUMN IF NOT EXISTS source VARCHAR(100);
ALTER TABLE applications ADD COLUMN IF NOT EXISTS score  SMALLINT DEFAULT 0;
```
