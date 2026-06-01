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
