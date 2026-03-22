# Task - Job Recruiter Assignment API

## Goal
Allow job owners to assign and remove recruiters from job postings.

## POST /api/jobs/:id/recruiters — Assign Recruiters
- Body: `{ user_ids: uuid[] }`
- Requires `requireAuth`
- Rules:
  1. Job must exist
  2. Only the job owner (`created_by === req.user.id`) can assign recruiters — return 403 otherwise
  3. Each `user_id` must be a valid user with role `recruiter` or `recruiter_admin`
  4. Insert into `job_recruiter` table — ignore duplicates (use `ON CONFLICT DO NOTHING`)
- Returns: `{ user_ids: uuid[] }` — complete list of recruiters assigned to this job

## DELETE /api/jobs/:id/recruiters — Remove Recruiters
- Body: `{ user_ids: uuid[] }`
- Requires `requireAuth`
- Rules:
  1. Only the job owner can remove recruiters — return 403 otherwise
  2. Remove matching entries from `job_recruiter`
  3. Ignore UUIDs not present in `job_recruiter`
- Returns: `{ user_ids: uuid[] }` — final remaining list

## Enhanced Job Load & Search
- `GET /api/jobs/:id` must include `recruiters[]`: `{ id, name, email }`
- `GET /api/jobs` must include `recruiters[]` for each job
- Source: `job_recruiter` table joined to `users`
