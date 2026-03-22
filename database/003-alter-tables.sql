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
