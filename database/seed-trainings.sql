-- ─────────────────────────────────────────────────────────────────────────────
-- Sample training catalogue seed
-- Idempotent: each insert is guarded by WHERE NOT EXISTS, so re-running
-- the script will skip rows that already exist.
--
-- Run against the same DATABASE_URL the backend uses.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO trainings (name, code, description, duration_days)
SELECT 'Cert III in Aged Care', 'CHC33015',
       'Foundational aged-care qualification. Covers personal care, wellbeing, dementia support.', 180
WHERE NOT EXISTS (SELECT 1 FROM trainings WHERE name = 'Cert III in Aged Care');

INSERT INTO trainings (name, code, description, duration_days)
SELECT 'Cert III in Individual Support', 'CHC33021',
       'Disability and aged-care support qualification. Ageing, disability, home and community streams.', 180
WHERE NOT EXISTS (SELECT 1 FROM trainings WHERE name = 'Cert III in Individual Support');

INSERT INTO trainings (name, code, description, duration_days)
SELECT 'Cert IV in Disability Support', 'CHC43121',
       'Advanced disability support — leadership, person-centred service planning.', 365
WHERE NOT EXISTS (SELECT 1 FROM trainings WHERE name = 'Cert IV in Disability Support');

INSERT INTO trainings (name, code, description, duration_days)
SELECT 'White Card', 'CPCWHS1001',
       'Construction site safety induction. Mandatory for anyone entering a construction site.', 1
WHERE NOT EXISTS (SELECT 1 FROM trainings WHERE name = 'White Card');

INSERT INTO trainings (name, code, description, duration_days)
SELECT 'First Aid Certificate', 'HLTAID011',
       'Provide first aid. Includes CPR. Valid 3 years; CPR refresh annually.', 1
WHERE NOT EXISTS (SELECT 1 FROM trainings WHERE name = 'First Aid Certificate');

INSERT INTO trainings (name, code, description, duration_days)
SELECT 'CPR Refresher', 'HLTAID009',
       'Annual CPR-only refresher.', 1
WHERE NOT EXISTS (SELECT 1 FROM trainings WHERE name = 'CPR Refresher');

INSERT INTO trainings (name, code, description, duration_days)
SELECT 'Forklift Licence', 'TLILIC0003',
       'High-risk work licence to operate forklift trucks. WorkSafe assessed.', 5
WHERE NOT EXISTS (SELECT 1 FROM trainings WHERE name = 'Forklift Licence');

INSERT INTO trainings (name, code, description, duration_days)
SELECT 'Food Handling', 'SITXFSA005',
       'Use hygienic practices for food safety. Required for food-service roles.', 1
WHERE NOT EXISTS (SELECT 1 FROM trainings WHERE name = 'Food Handling');

INSERT INTO trainings (name, code, description, duration_days)
SELECT 'Manual Handling', 'HLTWHS005',
       'Conduct manual tasks safely. Often paired with aged-care and warehousing.', 1
WHERE NOT EXISTS (SELECT 1 FROM trainings WHERE name = 'Manual Handling');

INSERT INTO trainings (name, code, description, duration_days)
SELECT 'Working with Children Check', NULL,
       'State-issued WWCC. Tracked here as a one-day training item.', 1
WHERE NOT EXISTS (SELECT 1 FROM trainings WHERE name = 'Working with Children Check');

INSERT INTO trainings (name, code, description, duration_days)
SELECT 'NDIS Worker Orientation Module', 'NDIS-WOM',
       'Free online module — Quality, Safety and You.', 1
WHERE NOT EXISTS (SELECT 1 FROM trainings WHERE name = 'NDIS Worker Orientation Module');

INSERT INTO trainings (name, code, description, duration_days)
SELECT 'Responsible Service of Alcohol', 'SITHFAB021',
       'Required for hospitality roles involving alcohol service.', 1
WHERE NOT EXISTS (SELECT 1 FROM trainings WHERE name = 'Responsible Service of Alcohol');

SELECT COUNT(*) AS total_trainings FROM trainings;
