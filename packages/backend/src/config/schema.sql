-- >>> 001-create-tables.sql
-- ── Extensions ────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Users ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          VARCHAR(255) NOT NULL,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(50)  NOT NULL DEFAULT 'recruiter',
                -- roles: admin | recruiter | hiring_manager
  avatar_url    TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Departments ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS departments (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Locations ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS locations (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  city       VARCHAR(255) NOT NULL,
  state      VARCHAR(255),
  country    VARCHAR(255) NOT NULL DEFAULT 'US',
  is_remote  BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Jobs ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS jobs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title           VARCHAR(255) NOT NULL,
  description     TEXT,
  department_id   UUID REFERENCES departments(id) ON DELETE SET NULL,
  location_id     UUID REFERENCES locations(id)   ON DELETE SET NULL,
  employment_type VARCHAR(50) NOT NULL DEFAULT 'full_time',
                  -- full_time | part_time | contract | internship
  status          VARCHAR(50) NOT NULL DEFAULT 'draft',
                  -- draft | open | closed | archived
  created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Candidates ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS candidates (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        VARCHAR(255) NOT NULL,
  email       VARCHAR(255) UNIQUE NOT NULL,
  phone       VARCHAR(50),
  resume_url  TEXT,
  linkedin    TEXT,
  notes       TEXT,
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Applications ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS applications (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id       UUID NOT NULL REFERENCES jobs(id)       ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  stage        VARCHAR(50) NOT NULL DEFAULT 'applied',
               -- applied | screening | interview | offer | hired | rejected
  notes        TEXT,
  rating       SMALLINT CHECK (rating BETWEEN 1 AND 5),
  applied_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (job_id, candidate_id)
);

-- ── Activity Log ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS activity_log (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type VARCHAR(50)  NOT NULL, -- job | candidate | application | user
  entity_id   UUID         NOT NULL,
  action      VARCHAR(100) NOT NULL, -- created | updated | stage_changed | etc.
  performed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_jobs_status       ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_department   ON jobs(department_id);
CREATE INDEX IF NOT EXISTS idx_applications_job  ON applications(job_id);
CREATE INDEX IF NOT EXISTS idx_applications_stage ON applications(stage);
CREATE INDEX IF NOT EXISTS idx_activity_entity   ON activity_log(entity_type, entity_id);


-- >>> 003-alter-tables.sql
-- Additional columns and tables (run after 001-create-tables.sql)

-- Jobs: extended fields
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS job_number            SERIAL;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS skills_required       TEXT[]        DEFAULT '{}';
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS skills_desired        TEXT[]        DEFAULT '{}';
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS job_type              VARCHAR(50);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS work_model            VARCHAR(50);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS cover_letter_required BOOLEAN       DEFAULT false;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS min_annual_salary     NUMERIC(12,2);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS max_annual_salary     NUMERIC(12,2);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS currency_code         VARCHAR(10)   DEFAULT 'USD';
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS experience_years_min  SMALLINT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS deadline              DATE;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS team                  VARCHAR(255);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS updated_by            UUID REFERENCES users(id) ON DELETE SET NULL;

-- Candidates: city/state
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS city  VARCHAR(255);
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS state VARCHAR(255);

-- Applications: source + score
ALTER TABLE applications ADD COLUMN IF NOT EXISTS source VARCHAR(100) DEFAULT 'manual';
ALTER TABLE applications ADD COLUMN IF NOT EXISTS score  SMALLINT     DEFAULT 0;

-- Job recruiter relationship
CREATE TABLE IF NOT EXISTS job_recruiter (
  job_id  UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (job_id, user_id)
);

-- Job activity log
CREATE TABLE IF NOT EXISTS job_activity (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id     UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  job_status VARCHAR(50),
  comment    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_activity_job ON job_activity(job_id);
CREATE INDEX IF NOT EXISTS idx_job_recruiter_job ON job_recruiter(job_id);


-- >>> 004-providers-employers.sql
-- ── Providers ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS providers (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         VARCHAR(255) NOT NULL,
  contact_name VARCHAR(255),
  email        VARCHAR(255),
  phone        VARCHAR(50),
  address      TEXT,
  is_active    BOOLEAN DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── Employers ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS employers (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- ── Seed Data ─────────────────────────────────────────────
INSERT INTO providers (id, name, contact_name, email, phone, address) VALUES
  ('00000000-0000-0000-0005-000000000001', 'Workforce Connect',   'Jane Harper',   'jane@workforceconnect.com.au',   '+61 2 9000 0001', '12 Bridge St, Sydney NSW 2000'),
  ('00000000-0000-0000-0005-000000000002', 'TalentBridge Group',  'Mark Sullivan', 'mark@talentbridge.com.au',        '+61 3 9000 0002', '45 Collins St, Melbourne VIC 3000'),
  ('00000000-0000-0000-0005-000000000003', 'CareerPath Services', 'Lisa Nguyen',   'lisa@careerpathservices.com.au',  '+61 7 9000 0003', '88 Queen St, Brisbane QLD 4000')
ON CONFLICT DO NOTHING;

INSERT INTO employers (id, name, industry, website, contact_name, contact_email, contact_phone, address) VALUES
  ('00000000-0000-0000-0006-000000000001', 'Acme Manufacturing',  'Manufacturing', 'https://acmemfg.com.au',       'Tom Richards',  'tom@acmemfg.com.au',       '+61 2 8000 1001', '100 Industrial Ave, Parramatta NSW 2150'),
  ('00000000-0000-0000-0006-000000000002', 'Metro Retail Group',  'Retail',        'https://metroretail.com.au',   'Sarah Bloom',   'sarah@metroretail.com.au', '+61 3 8000 1002', '220 Bourke St, Melbourne VIC 3000'),
  ('00000000-0000-0000-0006-000000000003', 'Greenfield Logistics','Logistics',     'https://greenfieldlog.com.au', 'David Chen',    'david@greenfieldlog.com.au','+61 7 8000 1003', '5 Port Rd, Brisbane QLD 4000')
ON CONFLICT DO NOTHING;


-- >>> 005-placements-welfare-checks.sql
-- Run after 004-providers-employers.sql

-- ── Placements ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS placements (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id        UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  candidate_id          UUID NOT NULL REFERENCES candidates(id),
  job_id                UUID NOT NULL REFERENCES jobs(id),
  employer_id           UUID REFERENCES employers(id),
  start_date            DATE NOT NULL,
  confirmed_by_employer BOOLEAN DEFAULT false,
  confirmation_sent_at  TIMESTAMPTZ,
  notes                 TEXT,
  created_by            UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ── Welfare Checks ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS welfare_checks (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  placement_id      UUID NOT NULL REFERENCES placements(id) ON DELETE CASCADE,
  check_type        VARCHAR(50) NOT NULL,
  -- day_1 | week_1 | month_1 | month_3 | month_6
  due_date          DATE NOT NULL,
  completed_at      TIMESTAMPTZ,
  employer_response TEXT,
  email_sent_at     TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_placements_application  ON placements(application_id);
CREATE INDEX IF NOT EXISTS idx_placements_candidate    ON placements(candidate_id);
CREATE INDEX IF NOT EXISTS idx_placements_job          ON placements(job_id);
CREATE INDEX IF NOT EXISTS idx_welfare_placement       ON welfare_checks(placement_id);
CREATE INDEX IF NOT EXISTS idx_welfare_due_date        ON welfare_checks(due_date);
CREATE INDEX IF NOT EXISTS idx_welfare_placement_date  ON welfare_checks(placement_id, due_date);


-- >>> 006-alter-candidates-jobs.sql
-- Run after 005-placements-welfare-checks.sql

-- ── Extend candidates ─────────────────────────────────────
ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS provider_id     UUID REFERENCES providers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS address_line1   VARCHAR(255),
  ADD COLUMN IF NOT EXISTS address_line2   VARCHAR(255),
  ADD COLUMN IF NOT EXISTS postcode        VARCHAR(20),
  ADD COLUMN IF NOT EXISTS country         VARCHAR(100) DEFAULT 'Australia',
  ADD COLUMN IF NOT EXISTS benchmark_hours INTEGER,
  ADD COLUMN IF NOT EXISTS work_status     VARCHAR(50)  DEFAULT 'job_seeking',
  ADD COLUMN IF NOT EXISTS interested_job  TEXT;
-- work_status values: job_seeking | employed | placed | inactive

-- ── Extend jobs ───────────────────────────────────────────
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS employer_id     UUID REFERENCES employers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS positions_count INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS job_board_url   TEXT;

-- ── Extend users (add provider role + provider_id FK) ─────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS provider_id UUID REFERENCES providers(id) ON DELETE SET NULL;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin', 'recruiter_admin', 'recruiter', 'staff', 'hiring_manager', 'provider', 'training_admin'));

-- ── Candidate Documents ───────────────────────────────────
CREATE TABLE IF NOT EXISTS candidate_documents (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id  UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  document_type VARCHAR(50) NOT NULL,
  -- cv | id | certificate | other
  file_name     VARCHAR(255) NOT NULL,
  file_path     VARCHAR(500) NOT NULL,
  file_size     INTEGER,
  mime_type     VARCHAR(100),
  uploaded_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_candidates_provider    ON candidates(provider_id);
CREATE INDEX IF NOT EXISTS idx_candidates_work_status ON candidates(work_status);
CREATE INDEX IF NOT EXISTS idx_jobs_employer          ON jobs(employer_id);
CREATE INDEX IF NOT EXISTS idx_candidate_docs         ON candidate_documents(candidate_id);

-- ── Seed: provider user ───────────────────────────────────
-- password = "password123"
INSERT INTO users (id, name, email, password_hash, role, provider_id) VALUES
  ('00000000-0000-0000-0000-000000000006', 'Peter Provider', 'provider@myats.dev',
   '$2b$10$JEQYphnwiuA4oN8ZNVQNcOiyzVvpfh/FY9i6L2PwCO.TpZaofHYJ6',
   'provider', '00000000-0000-0000-0005-000000000001')
ON CONFLICT DO NOTHING;

-- ── Link some candidates to providers ─────────────────────
UPDATE candidates SET
  provider_id     = '00000000-0000-0000-0005-000000000001',
  work_status     = 'job_seeking',
  benchmark_hours = 38,
  address_line1   = '10 George St',
  postcode        = '2000',
  country         = 'Australia'
WHERE id = '00000000-0000-0000-0004-000000000001';

UPDATE candidates SET
  provider_id     = '00000000-0000-0000-0005-000000000002',
  work_status     = 'job_seeking',
  benchmark_hours = 30
WHERE id = '00000000-0000-0000-0004-000000000002';

UPDATE candidates SET
  provider_id     = '00000000-0000-0000-0005-000000000001',
  work_status     = 'job_seeking',
  benchmark_hours = 40
WHERE id = '00000000-0000-0000-0004-000000000003';


-- >>> 008-vacancy-type.sql
-- Run after 007-demo-australia.sql

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS vacancy_type         VARCHAR(100),
  ADD COLUMN IF NOT EXISTS staff_working_status VARCHAR(50) DEFAULT 'active';
-- vacancy_type: full_time | part_time | casual | contract | temporary
-- staff_working_status: active | on_leave | resigned | terminated


-- >>> 009-new-fields.sql
-- Migration 009: Vacancy End Date + Wage Subsidy

-- Add end_date to jobs (Vacancy Details scope requirement)
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS end_date DATE;

-- Add wage subsidy fields to candidates (scope requirement: WS Yes/No + Amount)
ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS wage_subsidy        BOOLEAN        DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS wage_subsidy_amount NUMERIC(10,2);


-- >>> 010-candidate-training-dates.sql
-- Migration 010: Candidate training dates

ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS training_start_date DATE,
  ADD COLUMN IF NOT EXISTS training_end_date   DATE;


-- >>> 011-provider-spreadsheet-sync.sql
-- Migration 011: Provider spreadsheet sync support

-- Extend providers table with Microsoft OAuth tokens + spreadsheet config
ALTER TABLE providers
  ADD COLUMN IF NOT EXISTS ms_access_token     TEXT,
  ADD COLUMN IF NOT EXISTS ms_refresh_token    TEXT,
  ADD COLUMN IF NOT EXISTS ms_token_expiry     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ms_user_email       VARCHAR(255),
  ADD COLUMN IF NOT EXISTS onedrive_file_id    VARCHAR(500),
  ADD COLUMN IF NOT EXISTS onedrive_sheet_name VARCHAR(255) DEFAULT 'Sheet1',
  ADD COLUMN IF NOT EXISTS last_synced_at      TIMESTAMPTZ;

-- Add transport_type to candidates
ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS transport_type VARCHAR(20);
-- values: car | public_transport | both | none

-- Sync run history
CREATE TABLE IF NOT EXISTS provider_sync_logs (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_id        UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  triggered_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  status             VARCHAR(20) NOT NULL DEFAULT 'running',
  -- running | success | partial | failed
  candidates_created INTEGER DEFAULT 0,
  candidates_updated INTEGER DEFAULT 0,
  rows_written_back  INTEGER DEFAULT 0,
  rows_skipped       INTEGER DEFAULT 0,
  error_message      TEXT,
  started_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sync_logs_provider ON provider_sync_logs(provider_id);
CREATE INDEX IF NOT EXISTS idx_sync_logs_started  ON provider_sync_logs(started_at DESC);


-- >>> 012-training-module.sql
-- Migration 012: Training module
-- Catalogue of training courses + per-candidate enrolment history.

DO $$ BEGIN
  CREATE TYPE training_status AS ENUM ('enrolled','in_progress','completed','withdrawn','failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS trainings (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          VARCHAR(255) NOT NULL,
  code          VARCHAR(50),
  description   TEXT,
  duration_days INTEGER,
  provider_id   UUID REFERENCES providers(id) ON DELETE SET NULL,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS trainings_provider_idx ON trainings(provider_id);
CREATE INDEX IF NOT EXISTS trainings_active_idx   ON trainings(is_active);

CREATE TABLE IF NOT EXISTS candidate_trainings (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id    UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  training_id     UUID NOT NULL REFERENCES trainings(id)  ON DELETE RESTRICT,
  status          training_status NOT NULL DEFAULT 'enrolled',
  start_date      DATE,
  end_date        DATE,
  completed_at    DATE,
  certificate_no  VARCHAR(100),
  notes           TEXT,
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ct_candidate_idx ON candidate_trainings(candidate_id);
CREATE INDEX IF NOT EXISTS ct_training_idx  ON candidate_trainings(training_id);
CREATE INDEX IF NOT EXISTS ct_status_idx    ON candidate_trainings(status);


-- >>> 013-xero-invoicing.sql
-- Migration 013: Xero invoicing integration
-- Catalogue price, per-provider Xero contact cache, Xero OAuth singleton,
-- and per-invoice audit table.

ALTER TABLE trainings
  ADD COLUMN IF NOT EXISTS unit_price NUMERIC(10, 2);

ALTER TABLE providers
  ADD COLUMN IF NOT EXISTS xero_contact_id VARCHAR(36);

CREATE TABLE IF NOT EXISTS xero_connection (
  id              SERIAL PRIMARY KEY,
  tenant_id       VARCHAR(255) NOT NULL,
  tenant_name     VARCHAR(255),
  access_token    TEXT NOT NULL,
  refresh_token   TEXT NOT NULL,
  token_expiry    TIMESTAMPTZ NOT NULL,
  connected_by    UUID REFERENCES users(id),
  connected_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS xero_invoices (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_training_id   UUID NOT NULL REFERENCES candidate_trainings(id) ON DELETE CASCADE,
  xero_invoice_id         VARCHAR(36)  NOT NULL,
  xero_invoice_number     VARCHAR(50),
  xero_contact_id         VARCHAR(36)  NOT NULL,
  status                  VARCHAR(20)  NOT NULL DEFAULT 'DRAFT',
  total_amount            NUMERIC(10, 2),
  currency_code           VARCHAR(3)   NOT NULL DEFAULT 'AUD',
  xero_response           JSONB,
  created_by              UUID REFERENCES users(id),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS xi_candidate_training_idx ON xero_invoices(candidate_training_id);


-- >>> 014-candidate-notes.sql
-- ── Candidate Notes (Xero-style communication log) ───────────────────────────
-- Stores staff notes/communication logs against a candidate.
-- Each note records who wrote it and when.

CREATE TABLE IF NOT EXISTS candidate_notes (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID        NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  body         TEXT        NOT NULL CHECK (char_length(trim(body)) > 0),
  created_by   UUID        NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_candidate_notes_candidate_id ON candidate_notes(candidate_id);
CREATE INDEX IF NOT EXISTS idx_candidate_notes_created_at   ON candidate_notes(created_at DESC);


-- >>> 015-certificate-received.sql
-- Add certificate_received field to candidate_trainings
ALTER TABLE candidate_trainings
  ADD COLUMN IF NOT EXISTS certificate_received BOOLEAN DEFAULT NULL;


-- >>> 016-add-candidate-who-columns.sql
-- Migration to add Who columns (created_by, updated_by) to candidates table.
-- Existing records are unaffected (defaulting to NULL).

ALTER TABLE candidates ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(id) ON DELETE SET NULL;


-- >>> 017-staff-access-levels.sql
-- Migration: Add 'staff' and 'training_admin' to users_role_check constraint

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin', 'recruiter_admin', 'recruiter', 'staff', 'hiring_manager', 'provider', 'training_admin'));

-- Seed staff and training_admin test users if they do not exist
-- password = "password123"
INSERT INTO users (id, name, email, password_hash, role) VALUES
  ('00000000-0000-0000-0000-000000000007', 'Steve Staff', 'staff@myats.dev',
   '$2b$10$JEQYphnwiuA4oN8ZNVQNcOiyzVvpfh/FY9i6L2PwCO.TpZaofHYJ6', 'staff'),
  ('00000000-0000-0000-0000-000000000008', 'Tina TrainingAdmin', 'trainingadmin@myats.dev',
   '$2b$10$JEQYphnwiuA4oN8ZNVQNcOiyzVvpfh/FY9i6L2PwCO.TpZaofHYJ6', 'training_admin')
ON CONFLICT (id) DO NOTHING;


-- >>> add-master-tables.sql
-- Master Tables Migration
-- Run this once on your database

CREATE TABLE IF NOT EXISTS master_industries (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL UNIQUE,
  sort_order INT  NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS master_work_types (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL UNIQUE,
  sort_order INT  NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS master_work_status (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL UNIQUE,
  sort_order INT  NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default Industries
INSERT INTO master_industries (name, sort_order) VALUES
  ('Cleaning',        1),
  ('Warehouse',       2),
  ('Security',        3),
  ('Admin',           4),
  ('Call Centre',     5),
  ('Retail',          6),
  ('Hospitality',     7),
  ('Construction',    8),
  ('Logistics',       9),
  ('Manufacturing',  10),
  ('Healthcare',     11),
  ('IT',             12)
ON CONFLICT (name) DO NOTHING;

-- Seed default Work Types
INSERT INTO master_work_types (name, sort_order) VALUES
  ('Full-time',  1),
  ('Part-time',  2),
  ('Casual',     3),
  ('Contract',   4),
  ('Temporary',  5)
ON CONFLICT (name) DO NOTHING;

-- Seed default Work Status
INSERT INTO master_work_status (name, sort_order) VALUES
  ('Job Seeking', 1),
  ('Employed',    2),
  ('Placed',      3),
  ('Inactive',    4)
ON CONFLICT (name) DO NOTHING;


-- >>> candidate-form-redesign.sql
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


-- >>> vacancy-form-redesign.sql
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




CREATE TABLE IF NOT EXISTS application_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_system_prompt_snapshots (
  hash VARCHAR PRIMARY KEY,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL,
  application_id UUID NOT NULL,
  role VARCHAR NOT NULL,
  content TEXT NOT NULL,
  sender_type VARCHAR NOT NULL DEFAULT 'recruiter',
  sender_id UUID,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  model VARCHAR,
  system_prompt_hash VARCHAR,
  confidence VARCHAR,
  suggested_follow_ups JSONB,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS llm_request_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID,
  sender_id UUID,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS screening_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL,
  candidate_id UUID NOT NULL,
  job_id UUID NOT NULL,
  summary TEXT NOT NULL,
  score INTEGER NOT NULL,
  strengths JSONB NOT NULL DEFAULT '[]',
  concerns JSONB NOT NULL DEFAULT '[]',
  recommendation VARCHAR NOT NULL,
  model VARCHAR,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- >>> 018-candidate-and-employer-fields.sql
ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS intention_to_work TEXT DEFAULT 'suitable';

ALTER TABLE candidates
  ALTER COLUMN email DROP NOT NULL;

ALTER TABLE employers
  ADD COLUMN IF NOT EXISTS postcode VARCHAR(10),
  ADD COLUMN IF NOT EXISTS suburb   VARCHAR(255),
  ADD COLUMN IF NOT EXISTS state    VARCHAR(50),
  ADD COLUMN IF NOT EXISTS abn      VARCHAR(50);
