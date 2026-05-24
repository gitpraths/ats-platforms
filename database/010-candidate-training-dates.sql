-- Migration 010: Candidate training dates

ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS training_start_date DATE,
  ADD COLUMN IF NOT EXISTS training_end_date   DATE;
