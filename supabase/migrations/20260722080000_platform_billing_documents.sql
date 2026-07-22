-- Dedicated ledger for platform-issued receipts & invoices.
-- Independent of subscription_invoices so manual docs always work.

CREATE TABLE IF NOT EXISTS platform_billing_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_no text UNIQUE NOT NULL,
  kind text NOT NULL CHECK (kind IN ('receipt', 'invoice', 'payment', 'trial')),
  tenant_id uuid,
  facility_name text NOT NULL,
  customer_name text,
  customer_email text,
  description text,
  amount_ugx numeric(18, 2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'UGX',
  method text,
  notes text,
  due_date date,
  period_start timestamptz,
  period_end timestamptz,
  issued_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_billing_docs_issued
  ON platform_billing_documents (issued_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_billing_docs_kind
  ON platform_billing_documents (kind);

ALTER TABLE platform_billing_documents ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS platform_document_settings (
  id text PRIMARY KEY DEFAULT 'default',
  signature_data_url text,
  signer_name text,
  signer_title text DEFAULT 'CEO, Synapse OS',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE platform_document_settings ENABLE ROW LEVEL SECURITY;

INSERT INTO platform_document_settings (id, signer_name, signer_title)
VALUES ('default', 'Ebrine Tushabe', 'CEO, Synapse OS')
ON CONFLICT (id) DO UPDATE SET
  signer_name = EXCLUDED.signer_name,
  signer_title = EXCLUDED.signer_title;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'subscription_invoices'
      AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE subscription_invoices ALTER COLUMN tenant_id DROP NOT NULL;
  END IF;
END $$;
