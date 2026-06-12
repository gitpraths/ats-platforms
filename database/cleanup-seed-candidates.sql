-- ─────────────────────────────────────────────────────────────────────────────
-- Cleanup: remove the 14 deterministic seed candidates from production.
--
-- WHAT GETS DELETED:
--   - 14 rows from `candidates` whose UUID matches `00000000-0000-0000-0004-%`
--   - their applications (FK ON DELETE CASCADE)
--   - their candidate_documents and candidate_trainings (FK ON DELETE CASCADE)
--   - their 4 placements (NOT cascaded; deleted explicitly inside the txn)
--
-- WHAT DOES NOT GET DELETED:
--   - test-artefact candidates (Dup A, Test Candidate, Sync Test, etc.)
--     → see cleanup-test-artefacts.sql for those
--   - the 6 unique-named non-seed candidates (probably real)
--
-- Wrapped in BEGIN/COMMIT: if anything errors, the whole thing rolls back.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- Pre-check: show what will be deleted (review before COMMIT runs)
\echo 'Candidates to delete:'
SELECT id, name, email FROM candidates
 WHERE id::text LIKE '00000000-0000-0000-0004-%';

\echo 'Placements that block these candidates (deleted first):'
SELECT id, candidate_id FROM placements
 WHERE candidate_id::text LIKE '00000000-0000-0000-0004-%';

-- Step 1: drop the 4 placements that block the candidates (NO ACTION rule)
DELETE FROM placements
 WHERE candidate_id::text LIKE '00000000-0000-0000-0004-%';

-- Step 2: delete the seed candidates.
-- CASCADE rules wipe their applications, candidate_documents, candidate_trainings.
DELETE FROM candidates
 WHERE id::text LIKE '00000000-0000-0000-0004-%';

-- Confirm
SELECT COUNT(*) AS remaining_candidates FROM candidates;

COMMIT;
