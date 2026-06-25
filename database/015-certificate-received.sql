-- Add certificate_received field to candidate_trainings
ALTER TABLE candidate_trainings
  ADD COLUMN IF NOT EXISTS certificate_received BOOLEAN DEFAULT NULL;
