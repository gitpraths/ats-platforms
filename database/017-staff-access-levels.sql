-- Migration: Add 'staff' and 'training_admin' to users_role_check constraint

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin', 'recruiter_admin', 'recruiter', 'staff', 'hiring_manager', 'provider', 'training_admin'));

-- Seed staff and training_admin test users if they do not exist
-- password = "password123"
INSERT INTO users (id, name, email, password_hash, role) VALUES
  ('00000000-0000-0000-0000-000000000007', 'Steve Staff', 'staff@myats.dev',
   '$2b$10$JEQYphnwiuA4oN8ZNVQNcOiyzVvpfh/FY9i6L2PwCO.TpZaofHYJ6', 'staff'),
  ('00000000-0000-0000-0000-000000000008', 'Tina TrainingAdmin', 'trainingadmin@myats.dev',
   '$2b$10$JEQYphnwiuA4oN8ZNVQNcOiyzVvpfh/FY9i6L2PwCO.TpZaofHYJ6', 'training_admin')
ON CONFLICT (id) DO NOTHING;
