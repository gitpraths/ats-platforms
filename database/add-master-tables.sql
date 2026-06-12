-- Master Tables Migration
-- Run this once on your database

CREATE TABLE IF NOT EXISTS master_industries (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL UNIQUE,
  sort_order INT  NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS master_work_types (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL UNIQUE,
  sort_order INT  NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS master_work_status (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL UNIQUE,
  sort_order INT  NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default Industries
INSERT INTO master_industries (name, sort_order) VALUES
  ('Cleaning',        1),
  ('Warehouse',       2),
  ('Security',        3),
  ('Admin',           4),
  ('Call Centre',     5),
  ('Retail',          6),
  ('Hospitality',     7),
  ('Construction',    8),
  ('Logistics',       9),
  ('Manufacturing',  10),
  ('Healthcare',     11),
  ('IT',             12)
ON CONFLICT (name) DO NOTHING;

-- Seed default Work Types
INSERT INTO master_work_types (name, sort_order) VALUES
  ('Full-time',  1),
  ('Part-time',  2),
  ('Casual',     3),
  ('Contract',   4),
  ('Temporary',  5)
ON CONFLICT (name) DO NOTHING;

-- Seed default Work Status
INSERT INTO master_work_status (name, sort_order) VALUES
  ('Job Seeking', 1),
  ('Employed',    2),
  ('Placed',      3),
  ('Inactive',    4)
ON CONFLICT (name) DO NOTHING;
