-- ── Providers ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS providers (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         VARCHAR(255) NOT NULL,
  contact_name VARCHAR(255),
  email        VARCHAR(255),
  phone        VARCHAR(50),
  address      TEXT,
  is_active    BOOLEAN DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── Employers ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS employers (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          VARCHAR(255) NOT NULL,
  industry      VARCHAR(255),
  website       VARCHAR(500),
  description   TEXT,
  contact_name  VARCHAR(255),
  contact_email VARCHAR(255),
  contact_phone VARCHAR(50),
  address       TEXT,
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── Seed Data ─────────────────────────────────────────────
INSERT INTO providers (id, name, contact_name, email, phone, address) VALUES
  ('00000000-0000-0000-0005-000000000001', 'Workforce Connect',   'Jane Harper',   'jane@workforceconnect.com.au',   '+61 2 9000 0001', '12 Bridge St, Sydney NSW 2000'),
  ('00000000-0000-0000-0005-000000000002', 'TalentBridge Group',  'Mark Sullivan', 'mark@talentbridge.com.au',        '+61 3 9000 0002', '45 Collins St, Melbourne VIC 3000'),
  ('00000000-0000-0000-0005-000000000003', 'CareerPath Services', 'Lisa Nguyen',   'lisa@careerpathservices.com.au',  '+61 7 9000 0003', '88 Queen St, Brisbane QLD 4000')
ON CONFLICT DO NOTHING;

INSERT INTO employers (id, name, industry, website, contact_name, contact_email, contact_phone, address) VALUES
  ('00000000-0000-0000-0006-000000000001', 'Acme Manufacturing',  'Manufacturing', 'https://acmemfg.com.au',       'Tom Richards',  'tom@acmemfg.com.au',       '+61 2 8000 1001', '100 Industrial Ave, Parramatta NSW 2150'),
  ('00000000-0000-0000-0006-000000000002', 'Metro Retail Group',  'Retail',        'https://metroretail.com.au',   'Sarah Bloom',   'sarah@metroretail.com.au', '+61 3 8000 1002', '220 Bourke St, Melbourne VIC 3000'),
  ('00000000-0000-0000-0006-000000000003', 'Greenfield Logistics','Logistics',     'https://greenfieldlog.com.au', 'David Chen',    'david@greenfieldlog.com.au','+61 7 8000 1003', '5 Port Rd, Brisbane QLD 4000')
ON CONFLICT DO NOTHING;
