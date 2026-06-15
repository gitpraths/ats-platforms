-- Vacancy Form Redesign Migration
-- Adds new fields required by the 3-step vacancy form spec

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS industry              TEXT,
  ADD COLUMN IF NOT EXISTS pay_rate              NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS pay_rate_type         TEXT DEFAULT 'per_hour' CHECK (pay_rate_type IN ('per_hour','annual')),
  ADD COLUMN IF NOT EXISTS work_location         TEXT,
  ADD COLUMN IF NOT EXISTS police_check          TEXT DEFAULT 'not_required' CHECK (police_check IN ('yes','no','not_required')),
  ADD COLUMN IF NOT EXISTS drug_alcohol_test     TEXT DEFAULT 'no' CHECK (drug_alcohol_test IN ('yes','no')),
  ADD COLUMN IF NOT EXISTS wwc                   TEXT DEFAULT 'no' CHECK (wwc IN ('yes','no')),
  ADD COLUMN IF NOT EXISTS car_required          TEXT DEFAULT 'no' CHECK (car_required IN ('yes','no')),
  ADD COLUMN IF NOT EXISTS public_transport      TEXT DEFAULT 'no' CHECK (public_transport IN ('yes','no')),
  ADD COLUMN IF NOT EXISTS wage_subsidy_required TEXT DEFAULT 'no' CHECK (wage_subsidy_required IN ('yes','no')),
  ADD COLUMN IF NOT EXISTS comments              TEXT;

-- Add interview_date and ets_date to applications
ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS interview_date DATE,
  ADD COLUMN IF NOT EXISTS ets_date       DATE,
  ADD COLUMN IF NOT EXISTS placement_date DATE;
