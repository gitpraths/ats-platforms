-- ─────────────────────────────────────────────────────────────────────────────
-- Australian Demo Data — for client demo
-- Run after: 006-alter-candidates-jobs.sql
-- All passwords = "password123"
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Australian Locations ─────────────────────────────────────────────────────
INSERT INTO locations (id, city, state, country, is_remote) VALUES
  ('00000000-0000-0000-0002-000000000010', 'Sydney',     'NSW', 'Australia', false),
  ('00000000-0000-0000-0002-000000000011', 'Melbourne',  'VIC', 'Australia', false),
  ('00000000-0000-0000-0002-000000000012', 'Brisbane',   'QLD', 'Australia', false),
  ('00000000-0000-0000-0002-000000000013', 'Perth',      'WA',  'Australia', false),
  ('00000000-0000-0000-0002-000000000014', 'Adelaide',   'SA',  'Australia', false),
  ('00000000-0000-0000-0002-000000000015', 'Remote',     NULL,  'Australia', true)
ON CONFLICT (id) DO NOTHING;

-- ── Australian Departments ────────────────────────────────────────────────────
INSERT INTO departments (id, name) VALUES
  ('00000000-0000-0000-0001-000000000010', 'Warehouse & Logistics'),
  ('00000000-0000-0000-0001-000000000011', 'Retail & Customer Service'),
  ('00000000-0000-0000-0001-000000000012', 'Administration'),
  ('00000000-0000-0000-0001-000000000013', 'Trades & Labour'),
  ('00000000-0000-0000-0001-000000000014', 'Hospitality'),
  ('00000000-0000-0000-0001-000000000015', 'Healthcare Support')
ON CONFLICT (id) DO NOTHING;

-- ── Australian Staff Users ────────────────────────────────────────────────────
-- password = "password123"
INSERT INTO users (id, name, email, password_hash, role) VALUES
  ('00000000-0000-0000-0000-000000000010', 'Emma Wilson',   'emma@myats.dev',    '$2b$10$JEQYphnwiuA4oN8ZNVQNcOiyzVvpfh/FY9i6L2PwCO.TpZaofHYJ6', 'recruiter'),
  ('00000000-0000-0000-0000-000000000011', 'Liam Johnson',  'liam@myats.dev',    '$2b$10$JEQYphnwiuA4oN8ZNVQNcOiyzVvpfh/FY9i6L2PwCO.TpZaofHYJ6', 'recruiter')
ON CONFLICT (id) DO NOTHING;

-- ── Providers (Australian) ────────────────────────────────────────────────────
INSERT INTO providers (id, name, contact_name, email, phone, address, is_active) VALUES
  ('00000000-0000-0000-0005-000000000010', 'MAX Employment',          'Rachel Turner',   'rachel@maxemployment.com.au',    '+61 2 8765 0001', '55 Pitt Street, Sydney NSW 2000',            true),
  ('00000000-0000-0000-0005-000000000011', 'SLES Victoria',           'Michael Dunne',   'michael@slesvic.org.au',         '+61 3 9400 0002', '220 Spencer Street, Melbourne VIC 3000',     true),
  ('00000000-0000-0000-0005-000000000012', 'atWork Australia',        'Priya Sharma',    'priya@atworkaustralia.com.au',   '+61 7 3222 0003', '111 George Street, Brisbane QLD 4000',      true),
  ('00000000-0000-0000-0005-000000000013', 'Joblife Employment',      'Sandra Nguyen',   'sandra@joblife.com.au',          '+61 8 9300 0004', '45 St Georges Terrace, Perth WA 6000',      true),
  ('00000000-0000-0000-0005-000000000014', 'APM Employment Services', 'Craig Hollis',    'craig@apm.net.au',               '+61 8 8200 0005', '22 Grenfell Street, Adelaide SA 5000',      true)
ON CONFLICT (id) DO NOTHING;

-- ── Provider Users linked to providers ───────────────────────────────────────
INSERT INTO users (id, name, email, password_hash, role, provider_id) VALUES
  ('00000000-0000-0000-0000-000000000012', 'Rachel Turner',  'rachel@maxemployment.com.au', '$2b$10$JEQYphnwiuA4oN8ZNVQNcOiyzVvpfh/FY9i6L2PwCO.TpZaofHYJ6', 'provider', '00000000-0000-0000-0005-000000000010'),
  ('00000000-0000-0000-0000-000000000013', 'Michael Dunne',  'michael@slesvic.org.au',      '$2b$10$JEQYphnwiuA4oN8ZNVQNcOiyzVvpfh/FY9i6L2PwCO.TpZaofHYJ6', 'provider', '00000000-0000-0000-0005-000000000011')
ON CONFLICT (id) DO NOTHING;

-- ── Employers (Australian) ────────────────────────────────────────────────────
INSERT INTO employers (id, name, industry, website, contact_name, contact_email, contact_phone, address, is_active) VALUES
  ('00000000-0000-0000-0006-000000000010', 'Woolworths Group',        'Retail',        'https://www.woolworthsgroup.com.au', 'Karen Mitchell',  'karen.mitchell@woolworths.com.au',   '+61 2 8885 0010', '1 Woolworths Way, Bella Vista NSW 2153',     true),
  ('00000000-0000-0000-0006-000000000011', 'Toll Group',              'Logistics',     'https://www.tollgroup.com',          'Steve Rodgers',   'steve.rodgers@tollgroup.com',        '+61 3 9694 0011', '380 Docklands Drive, Melbourne VIC 3008',    true),
  ('00000000-0000-0000-0006-000000000012', 'Bunnings Warehouse',      'Retail',        'https://www.bunnings.com.au',        'Tracey Holden',   'tracey.holden@bunnings.com.au',      '+61 3 8831 0012', '1 Powell Street, Moorabbin VIC 3189',        true),
  ('00000000-0000-0000-0006-000000000013', 'Australia Post',          'Logistics',     'https://auspost.com.au',             'Gary Stephens',   'gary.stephens@auspost.com.au',       '+61 3 9767 0013', '111 Bourke Street, Melbourne VIC 3000',      true),
  ('00000000-0000-0000-0006-000000000014', 'Myer',                    'Retail',        'https://www.myer.com.au',            'Diane Foster',    'diane.foster@myer.com.au',           '+61 3 9661 0014', '295 Lonsdale Street, Melbourne VIC 3000',    true),
  ('00000000-0000-0000-0006-000000000015', 'St Vincent de Paul',      'Not-for-Profit','https://www.vinnies.org.au',         'Father Paul Reid', 'paul.reid@vinnies.org.au',          '+61 2 9264 0015', '180 Elizabeth Street, Sydney NSW 2000',      true),
  ('00000000-0000-0000-0006-000000000016', 'DHL Supply Chain AU',     'Logistics',     'https://www.dhl.com/au',             'Natalie Cross',   'natalie.cross@dhl.com',              '+61 2 9669 0016', '12 Bourke Road, Alexandria NSW 2015',        true),
  ('00000000-0000-0000-0006-000000000017', 'Coles Group',             'Retail',        'https://www.colesgroup.com.au',      'Simon Bright',    'simon.bright@colesgroup.com.au',     '+61 3 9829 0017', '800 Toorak Road, Hawthorn East VIC 3123',    true)
ON CONFLICT (id) DO NOTHING;

-- ── Australian Jobs linked to Employers ──────────────────────────────────────
INSERT INTO jobs (
  id, title, description, department_id, location_id,
  job_type, work_model, status,
  skills_required, skills_desired,
  positions_count, job_board_url,
  created_by, updated_by, employer_id
) VALUES

-- Job 1: Woolworths – Retail Team Member (Sydney)
(
  '00000000-0000-0000-0003-000000000020',
  'Retail Team Member',
  'Join the Woolworths team in Sydney. You will assist customers, stock shelves, operate registers, and maintain a clean and welcoming store environment. We are seeking enthusiastic team members who enjoy working with people. Flexible shifts available including weekends.',
  '00000000-0000-0000-0001-000000000011',
  '00000000-0000-0000-0002-000000000010',
  'part_time', 'onsite', 'open',
  ARRAY['Customer Service', 'Cash Handling', 'Teamwork'],
  ARRAY['Retail Experience', 'Stock Management'],
  4, 'https://www.seek.com.au/job/woolworths-retail-team-member',
  '00000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0006-000000000010'
),

-- Job 2: Toll Group – Warehouse Storeperson (Melbourne)
(
  '00000000-0000-0000-0003-000000000021',
  'Warehouse Storeperson',
  'Toll Group is seeking reliable Warehouse Storepersons for our Melbourne distribution centre. Responsibilities include receiving and dispatching goods, operating forklifts, picking and packing orders, and maintaining accurate stock records. Forklift licence required.',
  '00000000-0000-0000-0001-000000000010',
  '00000000-0000-0000-0002-000000000011',
  'full_time', 'onsite', 'open',
  ARRAY['Forklift Licence (LF)', 'Pick & Pack', 'WMS Systems'],
  ARRAY['RF Scanning', 'Voice Picking', 'Heavy Machinery'],
  3, 'https://www.seek.com.au/job/toll-warehouse-storeperson',
  '00000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0006-000000000011'
),

-- Job 3: Bunnings – Trade Sales Specialist (Brisbane)
(
  '00000000-0000-0000-0003-000000000022',
  'Trade Sales Specialist',
  'Bunnings Warehouse is looking for a Trade Sales Specialist to support our trade customers in Brisbane. You will build relationships with builders, tradies, and contractors, provide product advice, process trade orders, and ensure an outstanding customer experience.',
  '00000000-0000-0000-0001-000000000011',
  '00000000-0000-0000-0002-000000000012',
  'full_time', 'onsite', 'open',
  ARRAY['Trade Sales', 'Customer Service', 'Product Knowledge'],
  ARRAY['Building & Construction Knowledge', 'CRM'],
  2, 'https://www.seek.com.au/job/bunnings-trade-sales',
  '00000000-0000-0000-0000-000000000011',
  '00000000-0000-0000-0000-000000000011',
  '00000000-0000-0000-0006-000000000012'
),

-- Job 4: Australia Post – Postal Delivery Officer (Perth)
(
  '00000000-0000-0000-0003-000000000023',
  'Postal Delivery Officer',
  'Australia Post is hiring Postal Delivery Officers in Perth. You will sort and deliver mail and parcels along assigned routes using a vehicle or motorbike. A valid driver''s licence is essential. This is a physically active outdoor role with early morning starts.',
  '00000000-0000-0000-0001-000000000010',
  '00000000-0000-0000-0002-000000000013',
  'full_time', 'onsite', 'open',
  ARRAY['Driver Licence (C Class)', 'Physical Fitness', 'Time Management'],
  ARRAY['Motorbike Licence (R)', 'Route Knowledge'],
  5, 'https://www.seek.com.au/job/auspost-delivery-officer',
  '00000000-0000-0000-0000-000000000011',
  '00000000-0000-0000-0000-000000000011',
  '00000000-0000-0000-0006-000000000013'
),

-- Job 5: Myer – Customer Service Assistant (Melbourne)
(
  '00000000-0000-0000-0003-000000000024',
  'Customer Service Assistant',
  'Myer Melbourne is looking for enthusiastic Customer Service Assistants to join our team. You will assist customers with product selection, handle transactions, and maintain merchandise displays. Previous retail experience is preferred but not essential.',
  '00000000-0000-0000-0001-000000000011',
  '00000000-0000-0000-0002-000000000011',
  'part_time', 'onsite', 'open',
  ARRAY['Customer Service', 'POS Systems', 'Merchandising'],
  ARRAY['Fashion Knowledge', 'Visual Merchandising'],
  3, 'https://www.seek.com.au/job/myer-customer-service',
  '00000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0006-000000000014'
),

-- Job 6: DHL – Pick & Pack Operator (Sydney) – archived/filled
(
  '00000000-0000-0000-0003-000000000025',
  'Pick & Pack Operator',
  'DHL Supply Chain is seeking Pick & Pack Operators for our Alexandria facility. You will pick orders from racking, pack goods to specification, and ensure accuracy using RF scanners. Previous warehouse experience preferred.',
  '00000000-0000-0000-0001-000000000010',
  '00000000-0000-0000-0002-000000000010',
  'full_time', 'onsite', 'open',
  ARRAY['RF Scanning', 'Pick & Pack', 'Attention to Detail'],
  ARRAY['WMS Systems', 'Forklift (LF)'],
  2, 'https://www.seek.com.au/job/dhl-pick-pack',
  '00000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0006-000000000016'
),

-- Job 7: Coles – Nightfill Team Member (Adelaide)
(
  '00000000-0000-0000-0003-000000000026',
  'Nightfill Team Member',
  'Coles Adelaide is looking for Nightfill Team Members to replenish stock during evening/night hours. You will work as part of a team to ensure shelves are fully stocked and correctly ticketed for the next trading day. Flexible availability required.',
  '00000000-0000-0000-0001-000000000011',
  '00000000-0000-0000-0002-000000000014',
  'part_time', 'onsite', 'open',
  ARRAY['Manual Handling', 'Teamwork', 'Reliability'],
  ARRAY['Retail Experience', 'Stock Rotation'],
  3, 'https://www.seek.com.au/job/coles-nightfill',
  '00000000-0000-0000-0000-000000000011',
  '00000000-0000-0000-0000-000000000011',
  '00000000-0000-0000-0006-000000000017'
)

ON CONFLICT (id) DO NOTHING;

-- ── Job Recruiter Assignments ─────────────────────────────────────────────────
INSERT INTO job_recruiter (job_id, user_id) VALUES
  ('00000000-0000-0000-0003-000000000020', '00000000-0000-0000-0000-000000000010'), -- Emma
  ('00000000-0000-0000-0003-000000000021', '00000000-0000-0000-0000-000000000010'), -- Emma
  ('00000000-0000-0000-0003-000000000022', '00000000-0000-0000-0000-000000000011'), -- Liam
  ('00000000-0000-0000-0003-000000000023', '00000000-0000-0000-0000-000000000011'), -- Liam
  ('00000000-0000-0000-0003-000000000024', '00000000-0000-0000-0000-000000000010'), -- Emma
  ('00000000-0000-0000-0003-000000000025', '00000000-0000-0000-0000-000000000010'), -- Emma
  ('00000000-0000-0000-0003-000000000026', '00000000-0000-0000-0000-000000000011')  -- Liam
ON CONFLICT DO NOTHING;

-- ── Australian Candidates ─────────────────────────────────────────────────────
INSERT INTO candidates (
  id, name, email, phone, city, state,
  provider_id, address_line1, postcode, country,
  benchmark_hours, work_status, interested_job, notes
) VALUES
  -- MAX Employment candidates (Sydney)
  ('00000000-0000-0000-0004-000000000020', 'Jayden Murphy',    'jayden.murphy@gmail.com',    '+61 412 001 001', 'Sydney',    'NSW', '00000000-0000-0000-0005-000000000010', '14 Park Road',          '2145', 'Australia', 38, 'job_seeking', 'Warehouse or retail work', 'Good work ethic, completed cert II in logistics. Prefers morning shifts.'),
  ('00000000-0000-0000-0004-000000000021', 'Sophie Tran',      'sophie.tran@gmail.com',      '+61 412 001 002', 'Sydney',    'NSW', '00000000-0000-0000-0005-000000000010', '7 Crown Street',        '2010', 'Australia', 30, 'job_seeking', 'Retail or customer service', 'Friendly, customer-focused. Previous experience at Kmart. Available weekends.'),
  ('00000000-0000-0000-0004-000000000022', 'Marcus Williams',  'marcus.williams@gmail.com',  '+61 412 001 003', 'Sydney',    'NSW', '00000000-0000-0000-0005-000000000010', '32 Victoria Ave',       '2204', 'Australia', 38, 'placed',      'Warehouse storeperson',     'Forklift licence (LF). Reliable. Currently placed at DHL Alexandria.'),
  ('00000000-0000-0000-0004-000000000023', 'Aisha Patel',      'aisha.patel@gmail.com',      '+61 412 001 004', 'Sydney',    'NSW', '00000000-0000-0000-0005-000000000010', '88 Liverpool Road',     '2134', 'Australia', 25, 'job_seeking', 'Admin or reception',        'Certificate III in Business. Looking for part-time admin work close to Burwood.'),

  -- SLES Victoria candidates (Melbourne)
  ('00000000-0000-0000-0004-000000000024', 'Tom Nguyen',       'tom.nguyen@gmail.com',       '+61 413 002 001', 'Melbourne', 'VIC', '00000000-0000-0000-0005-000000000011', '15 Sunshine Ave',       '3020', 'Australia', 38, 'placed',      'Retail team member',        'Reliable and punctual. Currently placed at Myer Melbourne. Good feedback from employer.'),
  ('00000000-0000-0000-0004-000000000025', 'Lily Chen',        'lily.chen@gmail.com',        '+61 413 002 002', 'Melbourne', 'VIC', '00000000-0000-0000-0005-000000000011', '9 Brunswick Road',      '3056', 'Australia', 30, 'job_seeking', 'Retail or hospitality',     'Customer service experience at cafes. Studying Certificate III in retail.'),
  ('00000000-0000-0000-0004-000000000026', 'Daniel O''Brien',  'daniel.obrien@gmail.com',    '+61 413 002 003', 'Melbourne', 'VIC', '00000000-0000-0000-0005-000000000011', '44 Napier Street',      '3011', 'Australia', 38, 'job_seeking', 'Warehouse or delivery',     'HR licence, clean driving record. Looking for delivery or warehouse role.'),
  ('00000000-0000-0000-0004-000000000027', 'Mia Robertson',    'mia.robertson@gmail.com',    '+61 413 002 004', 'Melbourne', 'VIC', '00000000-0000-0000-0005-000000000011', '61 Sydney Road',        '3058', 'Australia', 20, 'placed',      'Nightfill or stock work',   'Currently placed at Coles Adelaide (relocated). Handles night shifts well.'),

  -- atWork Australia candidates (Brisbane)
  ('00000000-0000-0000-0004-000000000028', 'Connor Walsh',     'connor.walsh@gmail.com',     '+61 414 003 001', 'Brisbane',  'QLD', '00000000-0000-0000-0005-000000000012', '5 Ann Street',          '4000', 'Australia', 38, 'job_seeking', 'Trade sales or hardware',   'Background in construction. Keen on trade-facing sales role. Great with customers.'),
  ('00000000-0000-0000-0004-000000000029', 'Nina Perera',      'nina.perera@gmail.com',      '+61 414 003 002', 'Brisbane',  'QLD', '00000000-0000-0000-0005-000000000012', '18 Roma Street',        '4000', 'Australia', 25, 'job_seeking', 'Retail or admin',           'Previously worked at BigW. Fast learner, reliable. Prefers daytime shifts.'),

  -- Joblife Employment candidates (Perth)
  ('00000000-0000-0000-0004-000000000030', 'Ethan Clarke',     'ethan.clarke@gmail.com',     '+61 415 004 001', 'Perth',     'WA',  '00000000-0000-0000-0005-000000000013', '3 Murray Street',       '6000', 'Australia', 38, 'placed',      'Postal delivery officer',   'Clean driving record, good knowledge of Perth suburbs. Currently placed at Australia Post.'),
  ('00000000-0000-0000-0004-000000000031', 'Zara McDonald',    'zara.mcdonald@gmail.com',    '+61 415 004 002', 'Perth',     'WA',  '00000000-0000-0000-0005-000000000013', '77 Hay Street',         '6003', 'Australia', 30, 'job_seeking', 'Retail or customer service', 'Retail experience at Target. Friendly and organised.'),

  -- APM Employment candidates (Adelaide)
  ('00000000-0000-0000-0004-000000000032', 'Lucas Payne',      'lucas.payne@gmail.com',      '+61 416 005 001', 'Adelaide',  'SA',  '00000000-0000-0000-0005-000000000014', '10 King William St',    '5000', 'Australia', 38, 'job_seeking', 'Nightfill or warehouse',    'Night owl, available for evening and night shifts. Previously at Coles.'),
  ('00000000-0000-0000-0004-000000000033', 'Hannah Scott',     'hannah.scott@gmail.com',     '+61 416 005 002', 'Adelaide',  'SA',  '00000000-0000-0000-0005-000000000014', '88 Unley Road',         '5061', 'Australia', 25, 'inactive',    'Admin support',             'On medical leave. Expected to return to work in 3 months.')

ON CONFLICT (id) DO NOTHING;

-- ── Applications ──────────────────────────────────────────────────────────────
INSERT INTO applications (id, job_id, candidate_id, stage, source, score, notes) VALUES

  -- Woolworths Retail – Sydney
  ('00000000-0000-0000-0005-000000000020', '00000000-0000-0000-0003-000000000020', '00000000-0000-0000-0004-000000000020', 'interview', 'provider', 7, 'Phone screen done. Confident communicator. Interview booked with store manager.'),
  ('00000000-0000-0000-0005-000000000021', '00000000-0000-0000-0003-000000000020', '00000000-0000-0000-0004-000000000021', 'offer',     'provider', 8, 'Strong retail background. Verbal offer made. Awaiting signed contract.'),
  ('00000000-0000-0000-0005-000000000022', '00000000-0000-0000-0003-000000000020', '00000000-0000-0000-0004-000000000023', 'applied',   'provider', 0, 'Application received. Phone screen to be scheduled.'),

  -- Toll Warehouse – Melbourne
  ('00000000-0000-0000-0005-000000000023', '00000000-0000-0000-0003-000000000021', '00000000-0000-0000-0004-000000000026', 'screening', 'provider', 7, 'HR licence verified. Checking forklift ticket. Phone screen in progress.'),
  ('00000000-0000-0000-0005-000000000024', '00000000-0000-0000-0003-000000000021', '00000000-0000-0000-0004-000000000020', 'applied',   'provider', 0, 'Applied. Has LF licence. Needs availability confirmed.'),

  -- Bunnings Trade – Brisbane
  ('00000000-0000-0000-0005-000000000025', '00000000-0000-0000-0003-000000000022', '00000000-0000-0000-0004-000000000028', 'interview', 'provider', 8, 'Construction background is great fit. Interview with trade manager next Tuesday.'),
  ('00000000-0000-0000-0005-000000000026', '00000000-0000-0000-0003-000000000022', '00000000-0000-0000-0004-000000000029', 'applied',   'provider', 0, 'Applied. Assessing fit for trade role.'),

  -- Australia Post – Perth
  ('00000000-0000-0000-0005-000000000027', '00000000-0000-0000-0003-000000000023', '00000000-0000-0000-0004-000000000030', 'hired',     'provider', 9, 'Hired. Start date 2026-03-01. Clean driving record confirmed.'),
  ('00000000-0000-0000-0005-000000000028', '00000000-0000-0000-0003-000000000023', '00000000-0000-0000-0004-000000000031', 'screening', 'provider', 6, 'Has C class licence. Assessing route knowledge.'),

  -- Myer – Melbourne
  ('00000000-0000-0000-0005-000000000029', '00000000-0000-0000-0003-000000000024', '00000000-0000-0000-0004-000000000024', 'hired',     'provider', 8, 'Hired. Start date 2026-02-17. Employer very happy.'),
  ('00000000-0000-0000-0005-000000000030', '00000000-0000-0000-0003-000000000024', '00000000-0000-0000-0004-000000000025', 'interview', 'provider', 7, 'Good presentation. Interview with floor manager scheduled.'),

  -- DHL Pick & Pack – Sydney (filled)
  ('00000000-0000-0000-0005-000000000031', '00000000-0000-0000-0003-000000000025', '00000000-0000-0000-0004-000000000022', 'hired',     'provider', 9, 'Hired. Start date 2026-01-20. Forklift ticket confirmed.'),

  -- Coles Nightfill – Adelaide
  ('00000000-0000-0000-0005-000000000032', '00000000-0000-0000-0003-000000000026', '00000000-0000-0000-0004-000000000027', 'hired',     'provider', 8, 'Hired. Start date 2026-02-03. Night shifts working well.'),
  ('00000000-0000-0000-0005-000000000033', '00000000-0000-0000-0003-000000000026', '00000000-0000-0000-0004-000000000032', 'interview', 'provider', 7, 'Available nights. Interview with nightfill supervisor booked.')

ON CONFLICT (id) DO NOTHING;

-- ── Placements ────────────────────────────────────────────────────────────────
INSERT INTO placements (
  id, application_id, candidate_id, job_id, employer_id,
  start_date, confirmed_by_employer, confirmation_sent_at,
  notes, created_by
) VALUES

  -- Marcus Williams @ DHL (placed 2026-01-20)
  (
    '00000000-0000-0000-0007-000000000001',
    '00000000-0000-0000-0005-000000000031',
    '00000000-0000-0000-0004-000000000022',
    '00000000-0000-0000-0003-000000000025',
    '00000000-0000-0000-0006-000000000016',
    '2026-01-20', true, '2026-01-19 09:00:00+11',
    'Full-time warehouse operator. LF licence confirmed. Natalie at DHL very happy with performance.',
    '00000000-0000-0000-0000-000000000010'
  ),

  -- Tom Nguyen @ Myer Melbourne (placed 2026-02-17)
  (
    '00000000-0000-0000-0007-000000000002',
    '00000000-0000-0000-0005-000000000029',
    '00000000-0000-0000-0004-000000000024',
    '00000000-0000-0000-0003-000000000024',
    '00000000-0000-0000-0006-000000000014',
    '2026-02-17', true, '2026-02-16 10:00:00+11',
    'Part-time customer service. 3 shifts per week. Settling in well.',
    '00000000-0000-0000-0000-000000000010'
  ),

  -- Mia Robertson @ Coles Adelaide (placed 2026-02-03)
  (
    '00000000-0000-0000-0007-000000000003',
    '00000000-0000-0000-0005-000000000032',
    '00000000-0000-0000-0004-000000000027',
    '00000000-0000-0000-0003-000000000026',
    '00000000-0000-0000-0006-000000000017',
    '2026-02-03', true, '2026-02-02 11:00:00+11',
    'Nightfill team member. 4 nights per week. No issues reported.',
    '00000000-0000-0000-0000-000000000011'
  ),

  -- Ethan Clarke @ Australia Post Perth (placed 2026-03-01)
  (
    '00000000-0000-0000-0007-000000000004',
    '00000000-0000-0000-0005-000000000027',
    '00000000-0000-0000-0004-000000000030',
    '00000000-0000-0000-0003-000000000023',
    '00000000-0000-0000-0006-000000000013',
    '2026-03-01', false, NULL,
    'Postal delivery officer. Early morning route. Confirmation email pending.',
    '00000000-0000-0000-0000-000000000011'
  )

ON CONFLICT (id) DO NOTHING;

-- ── Welfare Checks ────────────────────────────────────────────────────────────

-- Placement 1: Marcus Williams @ DHL (start 2026-01-20)
INSERT INTO welfare_checks (placement_id, check_type, due_date, completed_at, employer_response, email_sent_at) VALUES
  ('00000000-0000-0000-0007-000000000001', 'day_1',   '2026-01-21', '2026-01-21 14:00:00+11', 'Marcus settled in well on Day 1. Forklift operations on point.', '2026-01-21 08:00:00+11'),
  ('00000000-0000-0000-0007-000000000001', 'week_1',  '2026-01-27', '2026-01-27 15:00:00+11', 'Excellent first week. Productive and punctual every day.',         '2026-01-27 08:00:00+11'),
  ('00000000-0000-0000-0007-000000000001', 'month_1', '2026-02-20', '2026-02-21 09:00:00+11', 'Marcus is a valued team member. We want to keep him on.',          '2026-02-20 08:00:00+11'),
  ('00000000-0000-0000-0007-000000000001', 'month_3', '2026-04-20', NULL, NULL, NULL),
  ('00000000-0000-0000-0007-000000000001', 'month_6', '2026-07-20', NULL, NULL, NULL)
ON CONFLICT DO NOTHING;

-- Placement 2: Tom Nguyen @ Myer (start 2026-02-17)
INSERT INTO welfare_checks (placement_id, check_type, due_date, completed_at, employer_response, email_sent_at) VALUES
  ('00000000-0000-0000-0007-000000000002', 'day_1',   '2026-02-18', '2026-02-18 16:00:00+11', 'Tom was welcomed by the team. Customers responded well to him.', '2026-02-18 08:00:00+11'),
  ('00000000-0000-0000-0007-000000000002', 'week_1',  '2026-02-24', '2026-02-25 10:00:00+11', 'Great first week. Learning the floor layout quickly.',            '2026-02-24 08:00:00+11'),
  ('00000000-0000-0000-0007-000000000002', 'month_1', '2026-03-17', '2026-03-18 11:00:00+11', 'Tom is doing well. No concerns. Customers love him.',             '2026-03-17 08:00:00+11'),
  ('00000000-0000-0000-0007-000000000002', 'month_3', '2026-05-17', NULL, NULL, NULL),
  ('00000000-0000-0000-0007-000000000002', 'month_6', '2026-08-17', NULL, NULL, NULL)
ON CONFLICT DO NOTHING;

-- Placement 3: Mia Robertson @ Coles (start 2026-02-03)
INSERT INTO welfare_checks (placement_id, check_type, due_date, completed_at, employer_response, email_sent_at) VALUES
  ('00000000-0000-0000-0007-000000000003', 'day_1',   '2026-02-04', '2026-02-04 07:00:00+11', 'Mia arrived on time and was enthusiastic on night one.',   '2026-02-04 06:00:00+11'),
  ('00000000-0000-0000-0007-000000000003', 'week_1',  '2026-02-10', '2026-02-10 08:00:00+11', 'Good first week. Completed nightfill training successfully.', '2026-02-10 06:00:00+11'),
  ('00000000-0000-0000-0007-000000000003', 'month_1', '2026-03-03', NULL, NULL, '2026-03-03 06:00:00+11'),
  ('00000000-0000-0000-0007-000000000003', 'month_3', '2026-05-03', NULL, NULL, NULL),
  ('00000000-0000-0000-0007-000000000003', 'month_6', '2026-08-03', NULL, NULL, NULL)
ON CONFLICT DO NOTHING;

-- Placement 4: Ethan Clarke @ Australia Post (start 2026-03-01)
INSERT INTO welfare_checks (placement_id, check_type, due_date, completed_at, employer_response, email_sent_at) VALUES
  ('00000000-0000-0000-0007-000000000004', 'day_1',   '2026-03-02', '2026-03-02 14:00:00+08', 'Ethan completed his first route without issues. Great start.', '2026-03-02 08:00:00+08'),
  ('00000000-0000-0000-0007-000000000004', 'week_1',  '2026-03-08', '2026-03-09 09:00:00+08', 'Excellent punctuality all week. Zero complaints from customers.', '2026-03-08 08:00:00+08'),
  ('00000000-0000-0000-0007-000000000004', 'month_1', '2026-04-01', NULL, NULL, NULL),
  ('00000000-0000-0000-0007-000000000004', 'month_3', '2026-06-01', NULL, NULL, NULL),
  ('00000000-0000-0000-0007-000000000004', 'month_6', '2026-09-01', NULL, NULL, NULL)
ON CONFLICT DO NOTHING;

-- ── Activity Log entries ───────────────────────────────────────────────────────
INSERT INTO activity_log (entity_type, entity_id, action, performed_by, metadata) VALUES
  ('placement', '00000000-0000-0000-0007-000000000001', 'created', '00000000-0000-0000-0000-000000000010', '{"note":"Marcus Williams placed at DHL"}'),
  ('placement', '00000000-0000-0000-0007-000000000002', 'created', '00000000-0000-0000-0000-000000000010', '{"note":"Tom Nguyen placed at Myer"}'),
  ('placement', '00000000-0000-0000-0007-000000000003', 'created', '00000000-0000-0000-0000-000000000011', '{"note":"Mia Robertson placed at Coles Adelaide"}'),
  ('placement', '00000000-0000-0000-0007-000000000004', 'created', '00000000-0000-0000-0000-000000000011', '{"note":"Ethan Clarke placed at Australia Post Perth"}')
ON CONFLICT DO NOTHING;
