-- Migration 009: Vacancy End Date + Wage Subsidy

-- Add end_date to jobs (Vacancy Details scope requirement)
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS end_date DATE;

-- Add wage subsidy fields to candidates (scope requirement: WS Yes/No + Amount)
ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS wage_subsidy        BOOLEAN        DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS wage_subsidy_amount NUMERIC(10,2);
