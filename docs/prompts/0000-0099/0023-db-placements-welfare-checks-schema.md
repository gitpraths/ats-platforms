# Task - Database: Placements & Welfare Checks Schema

## Goal
Create `placements` and `welfare_checks` tables to support post-placement tracking and welfare check milestones.

## Migration File
Create `database/005-placements-welfare-checks.sql`

## Placements Table
```sql
CREATE TABLE placements (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id        UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  candidate_id          UUID NOT NULL REFERENCES candidates(id),
  job_id                UUID NOT NULL REFERENCES jobs(id),
  employer_id           UUID REFERENCES employers(id),
  start_date            DATE NOT NULL,
  confirmed_by_employer BOOLEAN DEFAULT false,
  confirmation_sent_at  TIMESTAMPTZ,
  notes                 TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);
```

## Welfare Checks Table
```sql
CREATE TABLE welfare_checks (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  placement_id      UUID NOT NULL REFERENCES placements(id) ON DELETE CASCADE,
  check_type        VARCHAR(50) NOT NULL,  -- 'day_1', 'week_1', 'month_1', 'month_3', 'month_6'
  due_date          DATE NOT NULL,
  completed_at      TIMESTAMPTZ,
  employer_response TEXT,
  email_sent_at     TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);
```

## Welfare Check Auto-Generation
When a placement is inserted, auto-generate welfare_checks rows for all 5 milestones:
- `day_1`   → start_date + 1 day
- `week_1`  → start_date + 7 days
- `month_1` → start_date + 1 month
- `month_3` → start_date + 3 months
- `month_6` → start_date + 6 months

Implement this as a PostgreSQL trigger or handle in the backend service.

## Steps
- Run after `004-providers-employers.sql`
- Add index on `placements(application_id)` and `welfare_checks(placement_id, due_date)`
- Add index on `welfare_checks(due_date)` for the cron job query
