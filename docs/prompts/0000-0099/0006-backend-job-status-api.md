# Task - Job Status API

## Goal
Introduce a dedicated endpoint for job status changes and log all changes to `job_activity`.

## Rules
- A job is ALWAYS created in `draft` status
- `POST /api/jobs` and `PATCH /api/jobs/:id` must NOT accept a `status` field
- Status changes go through: `PATCH /api/jobs/:id/status` only

## New Endpoint: PATCH /api/jobs/:id/status

- Requires `requireAuth` middleware
- Body: `{ job_status: string, comment: string (optional) }`
- Valid values for `job_status`: `draft` | `published` | `archived`
- Validate `job_status` — return 400 if invalid

### Rules
1. Find the job by `job_id`
2. Update `jobs.status = job_status`
3. ALWAYS insert a record in `job_activity`:
   - `job_id` = from path param
   - `user_id` = `req.user.id`
   - `job_status` = new status
   - `comment` = from request body (optional)
   - `created_at` = `now()`
4. Return: `{ user_id, job_status, created_at }`
