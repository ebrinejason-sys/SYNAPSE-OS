-- Platform branding for official receipts/invoices (authorized signature).
-- Also relaxes subscription_invoices.tenant_id so walk-in/manual docs work.

CREATE TABLE IF NOT EXISTS platform_document_settings (
  id text PRIMARY KEY DEFAULT 'default',
  signature_data_url text,
  signer_name text,
  signer_title text DEFAULT 'Authorized Signatory',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE platform_document_settings ENABLE ROW LEVEL SECURITY;

-- Service-role client (platform admin server actions) bypasses RLS.
-- No authenticated client policies on purpose.

INSERT INTO platform_document_settings (id, signer_name, signer_title)
VALUES ('default', 'Ebrine Tushabe', 'CEO, Synapse OS')
ON CONFLICT (id) DO UPDATE SET
  signer_name = EXCLUDED.signer_name,
  signer_title = EXCLUDED.signer_title;

-- Manual receipts/invoices may target external customers without a tenant row
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'subscription_invoices'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'subscription_invoices' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE subscription_invoices ALTER COLUMN tenant_id DROP NOT NULL;
  END IF;
END $$;
