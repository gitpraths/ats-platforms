# Task - Job REST API

## Routes (`src/routes/jobs.js`)

All routes require `requireAuth` middleware.

### POST /api/jobs — Create Job
- Body fields:
  - `title`: string, required
  - `description`: string, optional
  - `department_id`: uuid, optional
  - `location_id`: uuid, optional
  - `skills_required`: string[], optional
  - `skills_desired`: string[], optional
  - `job_type`: oneOf('full_time', 'part_time', 'contract', 'internship'), required
  - `work_model`: oneOf('onsite', 'remote', 'hybrid'), required
  - `cover_letter_required`: boolean, optional
  - `min_annual_salary`: number, optional
  - `max_annual_salary`: number, optional
  - `currency_code`: oneOf('USD', 'EUR', 'CAD', 'MXN'), optional
  - `experience_years_min`: integer, optional
  - `deadline`: date, optional
  - `team`: string, optional

- Rules:
  - Job is ALWAYS created with `status = 'draft'` — do NOT accept status in create body
  - `created_by` = `req.user.id`
  - `id` = `uuid_generate_v4()`
  - Validate all required fields, reject with 400 if missing
  - Job number is an auto-incrementing sequence (use PostgreSQL SERIAL or sequence)

- Returns: `{ id, job_number, created_at }`

### PATCH /api/jobs/:id — Update Job
- Accepts same fields as create (all optional)
- Do NOT allow `status` change here — use `/status` endpoint instead
- Only update fields present in the request body
- Set `updated_at = now()`
- Returns: full updated job object

### DELETE /api/jobs/:id — Delete Job
- Returns: `{ id, status: "DELETED" }`

### GET /api/jobs/:id — Load Job
- Returns full job with:
  - department name
  - location details
  - `recruiters[]` list from `job_recruiter` table: `{ id, name, email }`

### GET /api/jobs — Search Jobs
- Optional query params:
  - `title`, `status`, `department_id`, `location_id`, `job_type`, `work_model`, `team`
  - `skills_required[]`, `skills_desired[]`
  - `page`, `limit` (default 1, 20)
- Returns jobs with: department name, location, recruiter list, application count

## Database Changes Needed
Add these columns to `jobs` table (update schema SQL):
```sql
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS job_number    SERIAL;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS skills_required   TEXT[];
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS skills_desired    TEXT[];
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS job_type          VARCHAR(50);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS work_model        VARCHAR(50);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS cover_letter_required BOOLEAN DEFAULT false;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS min_annual_salary NUMERIC;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS max_annual_salary NUMERIC;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS currency_code     VARCHAR(10);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS experience_years_min INT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS deadline          DATE;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS team              VARCHAR(255);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS updated_by        UUID REFERENCES users(id);

CREATE TABLE IF NOT EXISTS job_recruiter (
  job_id   UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  user_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (job_id, user_id)
);

CREATE TABLE IF NOT EXISTS job_activity (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id     UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES users(id),
  job_status VARCHAR(50),
  comment    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```
