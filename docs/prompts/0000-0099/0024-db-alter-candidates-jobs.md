# Task - Database: Alter Candidates & Jobs Tables

## Goal
Extend existing `candidates` and `jobs` tables with new fields required by the recruitment portal scope.

## Migration File
Create `database/006-alter-candidates-jobs.sql`

## Alter candidates
```sql
ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS provider_id     UUID REFERENCES providers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS address_line1   VARCHAR(255),
  ADD COLUMN IF NOT EXISTS address_line2   VARCHAR(255),
  ADD COLUMN IF NOT EXISTS postcode        VARCHAR(20),
  ADD COLUMN IF NOT EXISTS country         VARCHAR(100) DEFAULT 'Australia',
  ADD COLUMN IF NOT EXISTS benchmark_hours INTEGER,
  ADD COLUMN IF NOT EXISTS work_status     VARCHAR(50) DEFAULT 'job_seeking',
  ADD COLUMN IF NOT EXISTS interested_job  TEXT;

-- work_status allowed values: job_seeking, employed, placed, inactive
```

## Alter jobs
```sql
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS employer_id      UUID REFERENCES employers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS positions_count  INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS job_board_url    TEXT;
```

## Alter users (provider role)
```sql
-- Add 'provider' to the role enum/check constraint if applicable
-- If role is a VARCHAR with CHECK constraint, update it:
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin', 'recruiter_admin', 'recruiter', 'hiring_manager', 'provider'));
```

## Steps
- Run after `005-placements-welfare-checks.sql`
- Add index on `candidates(provider_id)`
- Add index on `candidates(work_status)`
- Add index on `jobs(employer_id)`
