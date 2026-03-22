-- Drop all tables (dev reset only — run before re-creating schema)
DROP TABLE IF EXISTS job_activity    CASCADE;
DROP TABLE IF EXISTS job_recruiter   CASCADE;
DROP TABLE IF EXISTS activity_log    CASCADE;
DROP TABLE IF EXISTS applications    CASCADE;
DROP TABLE IF EXISTS candidates      CASCADE;
DROP TABLE IF EXISTS jobs            CASCADE;
DROP TABLE IF EXISTS locations       CASCADE;
DROP TABLE IF EXISTS departments     CASCADE;
DROP TABLE IF EXISTS users           CASCADE;
