-- Migration 018: Add intention_to_work, relax candidate email constraint, and add employer address/abn fields
-- Safe and idempotent (can be run multiple times safely)

ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS intention_to_work TEXT DEFAULT 'suitable';

ALTER TABLE candidates
  ALTER COLUMN email DROP NOT NULL;

ALTER TABLE employers
  ADD COLUMN IF NOT EXISTS postcode VARCHAR(10),
  ADD COLUMN IF NOT EXISTS suburb   VARCHAR(255),
  ADD COLUMN IF NOT EXISTS state    VARCHAR(50),
  ADD COLUMN IF NOT EXISTS abn      VARCHAR(50);
