-- Migration 013: Xero invoicing integration
-- Catalogue price, per-provider Xero contact cache, Xero OAuth singleton,
-- and per-invoice audit table.

ALTER TABLE trainings
  ADD COLUMN IF NOT EXISTS unit_price NUMERIC(10, 2);

ALTER TABLE providers
  ADD COLUMN IF NOT EXISTS xero_contact_id VARCHAR(36);

CREATE TABLE IF NOT EXISTS xero_connection (
  id              SERIAL PRIMARY KEY,
  tenant_id       VARCHAR(255) NOT NULL,
  tenant_name     VARCHAR(255),
  access_token    TEXT NOT NULL,
  refresh_token   TEXT NOT NULL,
  token_expiry    TIMESTAMPTZ NOT NULL,
  connected_by    UUID REFERENCES users(id),
  connected_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS xero_invoices (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_training_id   UUID NOT NULL REFERENCES candidate_trainings(id) ON DELETE CASCADE,
  xero_invoice_id         VARCHAR(36)  NOT NULL,
  xero_invoice_number     VARCHAR(50),
  xero_contact_id         VARCHAR(36)  NOT NULL,
  status                  VARCHAR(20)  NOT NULL DEFAULT 'DRAFT',
  total_amount            NUMERIC(10, 2),
  currency_code           VARCHAR(3)   NOT NULL DEFAULT 'AUD',
  xero_response           JSONB,
  created_by              UUID REFERENCES users(id),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS xi_candidate_training_idx ON xero_invoices(candidate_training_id);
