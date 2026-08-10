-- Migration to add Who columns (created_by, updated_by) to candidates table.
-- Existing records are unaffected (defaulting to NULL).

ALTER TABLE candidates ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
