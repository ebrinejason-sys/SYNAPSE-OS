-- Hospital encounter payment collection (P1-008 closure)
-- Append-only payment rows; invoice paid_amount is derived from sum of payments.

CREATE TABLE IF NOT EXISTS public.billing_payments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  invoice_id       UUID NOT NULL REFERENCES public.billing_invoices(id) ON DELETE CASCADE,
  encounter_id     UUID REFERENCES public.encounters(id) ON DELETE SET NULL,
  patient_id       UUID REFERENCES public.patients(id) ON DELETE SET NULL,
  amount           NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  currency         TEXT NOT NULL DEFAULT 'UGX',
  payment_method   TEXT NOT NULL,
  payment_ref      TEXT,
  receipt_number   TEXT,
  idempotency_key  TEXT,
  received_by      UUID,
  notes            TEXT,
  is_deleted       BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_payments_idempotency
  ON public.billing_payments (tenant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_billing_payments_invoice
  ON public.billing_payments (tenant_id, invoice_id, created_at DESC);

ALTER TABLE public.billing_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY billing_payments_tenant_isolation ON public.billing_payments
  FOR ALL
  USING (tenant_id = (current_setting('request.jwt.claims', true)::json->>'tenant_id')::uuid)
  WITH CHECK (tenant_id = (current_setting('request.jwt.claims', true)::json->>'tenant_id')::uuid);

COMMENT ON TABLE public.billing_payments IS
  'Hospital encounter payments — cashier collection against billing_invoices. Idempotent via idempotency_key.';
