-- ─────────────────────────────────────────────────────────────────────────────
-- Cleanup: remove leftover Jest/Supertest fixture rows from production.
-- These were created by integration tests run against Railway during Phase 1
-- and Phase 2 and never cleaned up.
--
-- Targets candidates whose name matches a known fixture label.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

\echo 'Test-artefact candidates to delete:'
SELECT id, name, email FROM candidates
 WHERE name IN ('Dup A', 'Dup B', 'Test Candidate', 'Sync Test', 'Enrolment Test')
    OR name LIKE 'Bulk Test %';

-- Just in case any test-artefact candidates have placements (unlikely)
DELETE FROM placements
 WHERE candidate_id IN (
   SELECT id FROM candidates
    WHERE name IN ('Dup A', 'Dup B', 'Test Candidate', 'Sync Test', 'Enrolment Test')
       OR name LIKE 'Bulk Test %'
 );

-- Delete the candidates themselves; CASCADE handles their FK children.
DELETE FROM candidates
 WHERE name IN ('Dup A', 'Dup B', 'Test Candidate', 'Sync Test', 'Enrolment Test')
    OR name LIKE 'Bulk Test %';

-- Confirm
SELECT COUNT(*) AS remaining_candidates FROM candidates;

COMMIT;
