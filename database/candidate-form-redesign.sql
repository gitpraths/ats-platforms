-- Candidate Form Redesign Migration

-- 1. Create consultants table
CREATE TABLE IF NOT EXISTS consultants (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  email       TEXT,
  phone       TEXT,
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add SR No sequence
CREATE SEQUENCE IF NOT EXISTS candidate_sr_seq START 1;

-- 3. Add new columns to candidates
ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS sr_no               TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS first_name          TEXT,
  ADD COLUMN IF NOT EXISTS last_name           TEXT,
  ADD COLUMN IF NOT EXISTS date_referred       DATE,
  ADD COLUMN IF NOT EXISTS postcode            TEXT,
  ADD COLUMN IF NOT EXISTS suburb              TEXT,
  ADD COLUMN IF NOT EXISTS car                 TEXT DEFAULT 'no' CHECK (car IN ('yes','no')),
  ADD COLUMN IF NOT EXISTS police_check        TEXT DEFAULT 'no' CHECK (police_check IN ('yes','no')),
  ADD COLUMN IF NOT EXISTS wwc                 TEXT DEFAULT 'no' CHECK (wwc IN ('yes','no')),
  ADD COLUMN IF NOT EXISTS industry_preference TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS comments            TEXT,
  ADD COLUMN IF NOT EXISTS consultant_id       UUID REFERENCES consultants(id) ON DELETE SET NULL;

-- 4. Backfill sr_no for existing candidates
UPDATE candidates
SET sr_no = 'C-' || LPAD(nextval('candidate_sr_seq')::TEXT, 4, '0')
WHERE sr_no IS NULL;

-- 5. Backfill first_name/last_name from name
UPDATE candidates
SET
  first_name = split_part(name, ' ', 1),
  last_name  = CASE
    WHEN strpos(name, ' ') > 0
    THEN substring(name FROM strpos(name, ' ') + 1)
    ELSE ''
  END
WHERE first_name IS NULL;

-- 6. Backfill suburb from city (rename concept)
UPDATE candidates SET suburb = city WHERE suburb IS NULL AND city IS NOT NULL;
