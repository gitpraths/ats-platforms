-- Migration 011: Provider spreadsheet sync support

-- Extend providers table with Microsoft OAuth tokens + spreadsheet config
ALTER TABLE providers
  ADD COLUMN IF NOT EXISTS ms_access_token     TEXT,
  ADD COLUMN IF NOT EXISTS ms_refresh_token    TEXT,
  ADD COLUMN IF NOT EXISTS ms_token_expiry     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ms_user_email       VARCHAR(255),
  ADD COLUMN IF NOT EXISTS onedrive_file_id    VARCHAR(500),
  ADD COLUMN IF NOT EXISTS onedrive_sheet_name VARCHAR(255) DEFAULT 'Sheet1',
  ADD COLUMN IF NOT EXISTS last_synced_at      TIMESTAMPTZ;

-- Add transport_type to candidates
ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS transport_type VARCHAR(20);
-- values: car | public_transport | both | none

-- Sync run history
CREATE TABLE IF NOT EXISTS provider_sync_logs (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_id        UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  triggered_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  status             VARCHAR(20) NOT NULL DEFAULT 'running',
  -- running | success | partial | failed
  candidates_created INTEGER DEFAULT 0,
  candidates_updated INTEGER DEFAULT 0,
  rows_written_back  INTEGER DEFAULT 0,
  rows_skipped       INTEGER DEFAULT 0,
  error_message      TEXT,
  started_at         TIMESTAMPTZ DEFAULT NOW(),
  completed_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sync_logs_provider ON provider_sync_logs(provider_id);
CREATE INDEX IF NOT EXISTS idx_sync_logs_started  ON provider_sync_logs(started_at DESC);
