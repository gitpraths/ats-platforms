-- ─────────────────────────────────────────────────────────────────────────────
-- Seed data for development / demo
-- All passwords = "password123"
-- Run after: 001-create-tables.sql + 003-alter-tables.sql
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Users ────────────────────────────────────────────────────────────────────
INSERT INTO users (id, name, email, password_hash, role) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Alex Admin',        'admin@myats.dev',          '$2b$10$JEQYphnwiuA4oN8ZNVQNcOiyzVvpfh/FY9i6L2PwCO.TpZaofHYJ6', 'admin'),
  ('00000000-0000-0000-0000-000000000002', 'Jane Recruiter',    'jane@myats.dev',           '$2b$10$JEQYphnwiuA4oN8ZNVQNcOiyzVvpfh/FY9i6L2PwCO.TpZaofHYJ6', 'recruiter'),
  ('00000000-0000-0000-0000-000000000003', 'Mark Spencer',      'mark@myats.dev',           '$2b$10$JEQYphnwiuA4oN8ZNVQNcOiyzVvpfh/FY9i6L2PwCO.TpZaofHYJ6', 'recruiter'),
  ('00000000-0000-0000-0000-000000000004', 'Sarah Talent',      'sarah@myats.dev',          '$2b$10$JEQYphnwiuA4oN8ZNVQNcOiyzVvpfh/FY9i6L2PwCO.TpZaofHYJ6', 'recruiter_admin'),
  ('00000000-0000-0000-0000-000000000005', 'Tom HiringManager', 'tom@myats.dev',            '$2b$10$JEQYphnwiuA4oN8ZNVQNcOiyzVvpfh/FY9i6L2PwCO.TpZaofHYJ6', 'hiring_manager')
ON CONFLICT (id) DO NOTHING;

-- ── Departments ───────────────────────────────────────────────────────────────
INSERT INTO departments (id, name) VALUES
  ('00000000-0000-0000-0001-000000000001', 'Engineering'),
  ('00000000-0000-0000-0001-000000000002', 'Design'),
  ('00000000-0000-0000-0001-000000000003', 'Product'),
  ('00000000-0000-0000-0001-000000000004', 'Marketing'),
  ('00000000-0000-0000-0001-000000000005', 'Sales'),
  ('00000000-0000-0000-0001-000000000006', 'Human Resources')
ON CONFLICT (id) DO NOTHING;

-- ── Locations ─────────────────────────────────────────────────────────────────
INSERT INTO locations (id, city, state, country, is_remote) VALUES
  ('00000000-0000-0000-0002-000000000001', 'San Francisco', 'CA', 'US', false),
  ('00000000-0000-0000-0002-000000000002', 'New York',      'NY', 'US', false),
  ('00000000-0000-0000-0002-000000000003', 'Austin',        'TX', 'US', false),
  ('00000000-0000-0000-0002-000000000004', 'Chicago',       'IL', 'US', false),
  ('00000000-0000-0000-0002-000000000005', 'Remote',        NULL, 'US', true)
ON CONFLICT (id) DO NOTHING;

-- ── Jobs ──────────────────────────────────────────────────────────────────────
INSERT INTO jobs (
  id, title, description, department_id, location_id,
  job_type, work_model, status,
  skills_required, skills_desired,
  min_annual_salary, max_annual_salary, currency_code,
  experience_years_min, deadline, team,
  cover_letter_required, created_by, updated_by
) VALUES

-- 1. Senior Software Engineer (published)
(
  '00000000-0000-0000-0003-000000000001',
  'Senior Software Engineer',
  'We are looking for a Senior Software Engineer to join our Platform team. You will design and build scalable backend services, mentor junior engineers, and collaborate closely with product and design. You will be responsible for architecting new features, improving performance, and maintaining high code quality standards across our Node.js and PostgreSQL stack.',
  '00000000-0000-0000-0001-000000000001',
  '00000000-0000-0000-0002-000000000001',
  'full_time', 'hybrid', 'published',
  ARRAY['Node.js', 'PostgreSQL', 'REST APIs', 'TypeScript'],
  ARRAY['Docker', 'Kubernetes', 'AWS', 'Redis'],
  130000, 170000, 'USD',
  5, '2026-05-31', 'Platform',
  false,
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000002'
),

-- 2. Frontend Developer (published)
(
  '00000000-0000-0000-0003-000000000002',
  'Frontend Developer',
  'Join our Engineering team to build fast, accessible, and beautiful user interfaces. You will work closely with our Design team to implement pixel-perfect UI components using React and TypeScript. Experience with performance optimization and responsive design is essential.',
  '00000000-0000-0000-0001-000000000001',
  '00000000-0000-0000-0002-000000000005',
  'full_time', 'remote', 'published',
  ARRAY['React', 'TypeScript', 'Tailwind CSS', 'HTML/CSS'],
  ARRAY['Next.js', 'Figma', 'Testing Library', 'Storybook'],
  100000, 135000, 'USD',
  3, '2026-06-15', 'Web',
  false,
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000002'
),

-- 3. UX Designer (published)
(
  '00000000-0000-0000-0003-000000000003',
  'UX Designer',
  'We are seeking a UX Designer who is passionate about creating intuitive and delightful user experiences. You will conduct user research, create wireframes and prototypes, and collaborate with engineers to bring your designs to life. A strong portfolio demonstrating end-to-end design work is required.',
  '00000000-0000-0000-0001-000000000002',
  '00000000-0000-0000-0002-000000000002',
  'full_time', 'onsite', 'published',
  ARRAY['Figma', 'User Research', 'Wireframing', 'Prototyping'],
  ARRAY['Motion Design', 'Design Systems', 'Accessibility'],
  95000, 125000, 'USD',
  3, '2026-05-15', 'Design',
  true,
  '00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000003'
),

-- 4. Product Manager (published)
(
  '00000000-0000-0000-0003-000000000004',
  'Product Manager',
  'We are looking for an experienced Product Manager to own the roadmap for our core platform. You will work cross-functionally with engineering, design, and business stakeholders to define and deliver impactful features. Strong analytical skills and a data-driven mindset are a must.',
  '00000000-0000-0000-0001-000000000003',
  '00000000-0000-0000-0002-000000000001',
  'full_time', 'hybrid', 'published',
  ARRAY['Product Strategy', 'Roadmapping', 'Agile', 'Stakeholder Management'],
  ARRAY['SQL', 'Analytics Tools', 'A/B Testing', 'Jira'],
  120000, 155000, 'USD',
  4, '2026-06-30', 'Core Platform',
  false,
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000002'
),

-- 5. DevOps Engineer (published)
(
  '00000000-0000-0000-0003-000000000005',
  'DevOps Engineer',
  'We are hiring a DevOps Engineer to help us build and maintain our cloud infrastructure. You will manage CI/CD pipelines, improve system reliability, and work closely with the engineering team on deployment automation. Experience with Kubernetes and Terraform is highly valued.',
  '00000000-0000-0000-0001-000000000001',
  '00000000-0000-0000-0002-000000000005',
  'full_time', 'remote', 'published',
  ARRAY['Docker', 'Kubernetes', 'CI/CD', 'Linux'],
  ARRAY['Terraform', 'AWS', 'Prometheus', 'Grafana'],
  115000, 150000, 'USD',
  4, '2026-07-01', 'Infrastructure',
  false,
  '00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000003'
),

-- 6. Sales Representative (published)
(
  '00000000-0000-0000-0003-000000000006',
  'Sales Representative',
  'We are expanding our sales team and looking for a motivated Sales Representative. You will prospect and qualify leads, conduct product demos, and close deals. Experience in SaaS sales with a proven track record of meeting or exceeding quotas is required.',
  '00000000-0000-0000-0001-000000000005',
  '00000000-0000-0000-0002-000000000002',
  'full_time', 'onsite', 'published',
  ARRAY['SaaS Sales', 'CRM', 'Lead Generation', 'Negotiation'],
  ARRAY['Salesforce', 'HubSpot', 'Cold Outreach'],
  70000, 90000, 'USD',
  2, '2026-05-30', 'Enterprise',
  false,
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000002'
),

-- 7. Marketing Manager (draft)
(
  '00000000-0000-0000-0003-000000000007',
  'Marketing Manager',
  'We are looking for a Marketing Manager to lead our brand and demand generation efforts. You will manage campaigns across digital channels, coordinate content production, and analyze performance metrics to drive growth.',
  '00000000-0000-0000-0001-000000000004',
  '00000000-0000-0000-0002-000000000003',
  'full_time', 'hybrid', 'draft',
  ARRAY['Digital Marketing', 'Campaign Management', 'SEO/SEM', 'Analytics'],
  ARRAY['HubSpot', 'Google Ads', 'Content Strategy'],
  90000, 120000, 'USD',
  4, NULL, 'Growth',
  false,
  '00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000003'
),

-- 8. HR Specialist (draft)
(
  '00000000-0000-0000-0003-000000000008',
  'HR Specialist',
  'We are looking for an HR Specialist to support our people operations. You will handle onboarding, benefits administration, employee relations, and compliance. A background in HR for a tech company is a strong plus.',
  '00000000-0000-0000-0001-000000000006',
  '00000000-0000-0000-0002-000000000002',
  'full_time', 'onsite', 'draft',
  ARRAY['HR Operations', 'Onboarding', 'Employee Relations', 'HRIS'],
  ARRAY['Workday', 'BambooHR', 'Benefits Administration'],
  65000, 85000, 'USD',
  2, NULL, 'People Ops',
  false,
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000002'
),

-- 9. Backend Developer — Contract (published)
(
  '00000000-0000-0000-0003-000000000009',
  'Backend Developer (Contract)',
  'We are looking for an experienced Backend Developer for a 6-month contract engagement. You will help us deliver a new set of APIs for our partner integrations. Strong Node.js and PostgreSQL skills are required. Remote-friendly.',
  '00000000-0000-0000-0001-000000000001',
  '00000000-0000-0000-0002-000000000005',
  'contract', 'remote', 'published',
  ARRAY['Node.js', 'PostgreSQL', 'REST APIs'],
  ARRAY['GraphQL', 'Redis', 'TypeScript'],
  NULL, NULL, 'USD',
  3, '2026-04-30', 'Integrations',
  false,
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000002'
),

-- 10. Data Analyst (archived)
(
  '00000000-0000-0000-0003-000000000010',
  'Data Analyst',
  'This role has been filled. We were looking for a Data Analyst to help turn raw data into actionable insights for the product and business teams.',
  '00000000-0000-0000-0001-000000000003',
  '00000000-0000-0000-0002-000000000004',
  'full_time', 'hybrid', 'archived',
  ARRAY['SQL', 'Python', 'Data Visualization', 'Excel'],
  ARRAY['dbt', 'Tableau', 'Looker', 'Spark'],
  85000, 110000, 'USD',
  2, NULL, 'Analytics',
  false,
  '00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000003'
)
ON CONFLICT (id) DO NOTHING;

-- ── Job Recruiter Assignments ──────────────────────────────────────────────────
INSERT INTO job_recruiter (job_id, user_id) VALUES
  ('00000000-0000-0000-0003-000000000001', '00000000-0000-0000-0000-000000000002'), -- Jane on Senior SE
  ('00000000-0000-0000-0003-000000000002', '00000000-0000-0000-0000-000000000002'), -- Jane on Frontend Dev
  ('00000000-0000-0000-0003-000000000003', '00000000-0000-0000-0000-000000000003'), -- Mark on UX Designer
  ('00000000-0000-0000-0003-000000000004', '00000000-0000-0000-0000-000000000002'), -- Jane on Product Manager
  ('00000000-0000-0000-0003-000000000005', '00000000-0000-0000-0000-000000000003'), -- Mark on DevOps
  ('00000000-0000-0000-0003-000000000006', '00000000-0000-0000-0000-000000000003'), -- Mark on Sales Rep
  ('00000000-0000-0000-0003-000000000009', '00000000-0000-0000-0000-000000000002')  -- Jane on Contract Dev
ON CONFLICT DO NOTHING;

-- ── Job Activity Log ──────────────────────────────────────────────────────────
INSERT INTO job_activity (job_id, user_id, job_status, comment) VALUES
  ('00000000-0000-0000-0003-000000000001', '00000000-0000-0000-0000-000000000002', 'draft',     'Job created'),
  ('00000000-0000-0000-0003-000000000001', '00000000-0000-0000-0000-000000000002', 'published', 'Approved and posted'),
  ('00000000-0000-0000-0003-000000000002', '00000000-0000-0000-0000-000000000002', 'draft',     'Job created'),
  ('00000000-0000-0000-0003-000000000002', '00000000-0000-0000-0000-000000000002', 'published', 'Ready to post'),
  ('00000000-0000-0000-0003-000000000010', '00000000-0000-0000-0000-000000000003', 'draft',     'Job created'),
  ('00000000-0000-0000-0003-000000000010', '00000000-0000-0000-0000-000000000003', 'published', 'Posted externally'),
  ('00000000-0000-0000-0003-000000000010', '00000000-0000-0000-0000-000000000001', 'archived',  'Position filled internally');

-- ── Candidates ────────────────────────────────────────────────────────────────
INSERT INTO candidates (id, name, email, phone, linkedin, notes, city, state) VALUES
  ('00000000-0000-0000-0004-000000000001', 'Alice Chen',        'alice.chen@email.com',      '+1-415-555-0101', 'linkedin.com/in/alicechen',     '8 years Node.js, previously at Stripe. Strong system design skills.',          'San Francisco', 'CA'),
  ('00000000-0000-0000-0004-000000000002', 'Brian Okafor',      'brian.okafor@email.com',    '+1-512-555-0102', 'linkedin.com/in/brianokafor',    'Full-stack engineer, solid React and PostgreSQL experience.',                   'Austin',        'TX'),
  ('00000000-0000-0000-0004-000000000003', 'Carmen Reyes',      'carmen.reyes@email.com',    '+1-212-555-0103', 'linkedin.com/in/carmenreyes',    'Senior UX Designer, 6 years at consumer tech startups. Great portfolio.',      'New York',      'NY'),
  ('00000000-0000-0000-0004-000000000004', 'David Kim',         'david.kim@email.com',       '+1-415-555-0104', 'linkedin.com/in/davidkim',       'Product Manager with deep experience in B2B SaaS. MBA from Stanford.',         'San Francisco', 'CA'),
  ('00000000-0000-0000-0004-000000000005', 'Emily Nguyen',      'emily.nguyen@email.com',    '+1-312-555-0105', 'linkedin.com/in/emilynguyen',    'DevOps engineer, strong Kubernetes and Terraform background.',                  'Chicago',       'IL'),
  ('00000000-0000-0000-0004-000000000006', 'Frank Torres',      'frank.torres@email.com',    '+1-212-555-0106', NULL,                             'Sales rep, 5 years SaaS experience, consistently exceeds quota.',              'New York',      'NY'),
  ('00000000-0000-0000-0004-000000000007', 'Grace Liu',         'grace.liu@email.com',       '+1-415-555-0107', 'linkedin.com/in/graceliu',       'Frontend specialist, React + TypeScript, open-source contributor.',            'San Francisco', 'CA'),
  ('00000000-0000-0000-0004-000000000008', 'Henry Walker',      'henry.walker@email.com',    '+1-737-555-0108', 'linkedin.com/in/henrywalker',    'Backend developer with Node.js and GraphQL focus.',                            'Austin',        'TX'),
  ('00000000-0000-0000-0004-000000000009', 'Isabel Martinez',   'isabel.martinez@email.com', '+1-212-555-0109', 'linkedin.com/in/isabelmartinez', 'HR generalist, 4 years in tech companies, great communicator.',               'New York',      'NY'),
  ('00000000-0000-0000-0004-000000000010', 'James Park',        'james.park@email.com',      '+1-415-555-0110', 'linkedin.com/in/jamespark',      'Senior engineer, Go and Kubernetes, previously at Google.',                    'San Francisco', 'CA'),
  ('00000000-0000-0000-0004-000000000011', 'Karen Brown',       'karen.brown@email.com',     '+1-312-555-0111', 'linkedin.com/in/karenbrown',     'Data analyst, strong SQL and Python. Experience with dbt and Looker.',         'Chicago',       'IL'),
  ('00000000-0000-0000-0004-000000000012', 'Leo Fernandez',     'leo.fernandez@email.com',   '+1-737-555-0112', NULL,                             'Marketing manager, led growth campaigns at two SaaS startups.',               'Austin',        'TX'),
  ('00000000-0000-0000-0004-000000000013', 'Mia Johnson',       'mia.johnson@email.com',     '+1-212-555-0113', 'linkedin.com/in/miajohnson',     'UX designer with strong research and prototyping skills. Figma expert.',      'New York',      'NY'),
  ('00000000-0000-0000-0004-000000000014', 'Nathan Scott',      'nathan.scott@email.com',    '+1-415-555-0114', 'linkedin.com/in/nathanscott',    'Full-stack developer, 4 years exp. React + Node + PostgreSQL.',               'San Francisco', 'CA'),
  ('00000000-0000-0000-0004-000000000015', 'Olivia Wright',     'olivia.wright@email.com',   '+1-312-555-0115', 'linkedin.com/in/oliviawright',   'Contract backend developer, available immediately. Strong REST API skills.',   'Chicago',       'IL')
ON CONFLICT (id) DO NOTHING;

-- ── Applications ──────────────────────────────────────────────────────────────
INSERT INTO applications (id, job_id, candidate_id, stage, source, score, notes) VALUES

  -- Senior Software Engineer
  ('00000000-0000-0000-0005-000000000001', '00000000-0000-0000-0003-000000000001', '00000000-0000-0000-0004-000000000001', 'offer',     'linkedin',   9, 'Excellent system design skills. Strong culture fit. Awaiting offer response.'),
  ('00000000-0000-0000-0005-000000000002', '00000000-0000-0000-0003-000000000001', '00000000-0000-0000-0004-000000000010', 'interview',  'referral',   8, 'Second technical interview scheduled. Very strong backend skills.'),
  ('00000000-0000-0000-0005-000000000003', '00000000-0000-0000-0003-000000000001', '00000000-0000-0000-0004-000000000014', 'screening',  'website',    6, 'Phone screen scheduled. 4 years experience, slightly below requirement.'),

  -- Frontend Developer
  ('00000000-0000-0000-0005-000000000004', '00000000-0000-0000-0003-000000000002', '00000000-0000-0000-0004-000000000007', 'interview',  'linkedin',   9, 'Outstanding React skills. Open source contributions impressive.'),
  ('00000000-0000-0000-0005-000000000005', '00000000-0000-0000-0003-000000000002', '00000000-0000-0000-0004-000000000002', 'screening',  'website',    7, 'Good full-stack background. React experience is solid.'),
  ('00000000-0000-0000-0005-000000000006', '00000000-0000-0000-0003-000000000002', '00000000-0000-0000-0004-000000000014', 'applied',    'referral',   0, NULL),

  -- UX Designer
  ('00000000-0000-0000-0005-000000000007', '00000000-0000-0000-0003-000000000003', '00000000-0000-0000-0004-000000000003', 'hired',      'linkedin',   10, 'Exceptional portfolio. Hired. Start date confirmed.'),
  ('00000000-0000-0000-0005-000000000008', '00000000-0000-0000-0003-000000000003', '00000000-0000-0000-0004-000000000013', 'rejected',   'website',    6,  'Good skills but portfolio did not meet expectations for this level.'),

  -- Product Manager
  ('00000000-0000-0000-0005-000000000009', '00000000-0000-0000-0003-000000000004', '00000000-0000-0000-0004-000000000004', 'offer',      'referral',   9, 'Strong product instincts. MBA a plus. Final offer stage.'),
  ('00000000-0000-0000-0005-000000000010', '00000000-0000-0000-0003-000000000004', '00000000-0000-0000-0004-000000000002', 'interview',  'linkedin',   7, 'Good analytical background. Interview panel scheduled.'),

  -- DevOps Engineer
  ('00000000-0000-0000-0005-000000000011', '00000000-0000-0000-0003-000000000005', '00000000-0000-0000-0004-000000000005', 'interview',  'linkedin',   8, 'Strong Kubernetes background. Take-home task completed.'),
  ('00000000-0000-0000-0005-000000000012', '00000000-0000-0000-0003-000000000005', '00000000-0000-0000-0004-000000000010', 'screening',  'website',    7, 'Kubernetes certified. Scheduling phone screen.'),

  -- Sales Representative
  ('00000000-0000-0000-0005-000000000013', '00000000-0000-0000-0003-000000000006', '00000000-0000-0000-0004-000000000006', 'offer',      'referral',   9, 'Great closer. Quota track record impressive. Verbal offer extended.'),

  -- Backend Developer Contract
  ('00000000-0000-0000-0005-000000000014', '00000000-0000-0000-0003-000000000009', '00000000-0000-0000-0004-000000000015', 'interview',  'website',    8, 'Available immediately. Strong REST API experience. Contract terms discussed.'),
  ('00000000-0000-0000-0005-000000000015', '00000000-0000-0000-0003-000000000009', '00000000-0000-0000-0004-000000000008', 'screening',  'linkedin',   7, 'GraphQL experience relevant. Scheduling call.'),

  -- Data Analyst (archived job — rejected/hired)
  ('00000000-0000-0000-0005-000000000016', '00000000-0000-0000-0003-000000000010', '00000000-0000-0000-0004-000000000011', 'hired',      'referral',   9, 'Hired. Role now archived.'),
  ('00000000-0000-0000-0005-000000000017', '00000000-0000-0000-0003-000000000010', '00000000-0000-0000-0004-000000000004', 'rejected',   'website',    5, 'Not the right fit for this role.')

ON CONFLICT (id) DO NOTHING;
