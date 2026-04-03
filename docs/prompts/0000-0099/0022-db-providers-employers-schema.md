# Task - Database: Providers & Employers Schema

## Goal
Create new `providers` and `employers` tables as part of Phase 1 data model extension for the recruitment portal scope.

## Migration File
Create `database/004-providers-employers.sql`

## Providers Table
```sql
CREATE TABLE providers (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         VARCHAR(255) NOT NULL,
  contact_name VARCHAR(255),
  email        VARCHAR(255),
  phone        VARCHAR(50),
  address      TEXT,
  is_active    BOOLEAN DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);
```

## Employers Table
```sql
CREATE TABLE employers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(255) NOT NULL,
  industry      VARCHAR(255),
  website       VARCHAR(500),
  description   TEXT,
  contact_name  VARCHAR(255),
  contact_email VARCHAR(255),
  contact_phone VARCHAR(50),
  address       TEXT,
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);
```

## Seed Data
Add 3 sample providers and 3 sample employers to `database/002-seed-data.sql` (or append a new seed block).

## Steps
- Write `database/004-providers-employers.sql` with both CREATE TABLE statements
- Add `updated_at` trigger function (reuse pattern from existing schema if present)
- Verify tables are compatible with the FK references in `005-placements-welfare-checks.sql` (next prompt)
