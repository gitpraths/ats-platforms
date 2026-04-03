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
