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
