-- Run after 007-demo-australia.sql

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS vacancy_type         VARCHAR(100),
  ADD COLUMN IF NOT EXISTS staff_working_status VARCHAR(50) DEFAULT 'active';
-- vacancy_type: full_time | part_time | casual | contract | temporary
-- staff_working_status: active | on_leave | resigned | terminated
