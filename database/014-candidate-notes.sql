-- ── Candidate Notes (Xero-style communication log) ───────────────────────────
-- Stores staff notes/communication logs against a candidate.
-- Each note records who wrote it and when.

CREATE TABLE IF NOT EXISTS candidate_notes (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID        NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  body         TEXT        NOT NULL CHECK (char_length(trim(body)) > 0),
  created_by   UUID        NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_candidate_notes_candidate_id ON candidate_notes(candidate_id);
CREATE INDEX IF NOT EXISTS idx_candidate_notes_created_at   ON candidate_notes(created_at DESC);
