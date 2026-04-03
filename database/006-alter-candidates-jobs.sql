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
  CHECK (role IN ('admin', 'recruiter_admin', 'recruiter', 'hiring_manager', 'provider'));

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
WHERE id = '00000000-0000-0004-000000000001' OR id = '00000000-0000-0000-0004-000000000001';

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
