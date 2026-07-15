-- Subscription invoices — Kampala-numbered ledger for SaaS subscription payments.
--
-- NOTE: billing_invoices (referenced in the SaaS brief) is the HOSPITAL
-- patient-billing table (patient_id / encounter_id) and must not be reused for
-- subscription invoices — live schema wins. This table is the subscription
-- counterpart. Until this migration is applied, the app falls back to stamping
-- invoice_no into subscription_payments.raw_payload, so no invoice number is lost.
--
-- Additive only. Safe to run against live project qfqakzmjatszisuqjwon.

CREATE TABLE IF NOT EXISTS subscription_invoices (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  payment_id   uuid REFERENCES subscription_payments(id),
  plan_id      uuid REFERENCES subscription_plans(id),
  -- INV-YYYYMMDD-#### where the date is Africa/Kampala at issue time
  invoice_no   text UNIQUE NOT NULL,
  amount_ugx   numeric NOT NULL,
  currency     text NOT NULL DEFAULT 'UGX',
  period_start timestamptz,
  period_end   timestamptz,
  issued_at    timestamptz NOT NULL DEFAULT now(),
  metadata     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sub_invoices_tenant  ON subscription_invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sub_invoices_created ON subscription_invoices(created_at DESC);

-- Tenant admins may read their own invoices; all writes are service-role only
-- (service role bypasses RLS; no INSERT/UPDATE/DELETE policies on purpose).
ALTER TABLE subscription_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS subscription_invoices_tenant_read ON subscription_invoices;
CREATE POLICY subscription_invoices_tenant_read ON subscription_invoices
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid())
  );
