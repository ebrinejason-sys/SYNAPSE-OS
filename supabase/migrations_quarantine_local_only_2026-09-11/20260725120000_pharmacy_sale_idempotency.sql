-- Disable legacy non-atomic POS transaction path.
-- All sales must go through POST /api/admin/pos/complete-sale → complete_pharmacy_sale RPC.

CREATE TABLE IF NOT EXISTS public.pharmacy_sale_idempotency (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  idempotency_key text NOT NULL,
  sale_id uuid,
  response_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pharmacy_sale_idempotency_tenant_key UNIQUE (tenant_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS pharmacy_sale_idempotency_tenant_created_idx
  ON public.pharmacy_sale_idempotency (tenant_id, created_at DESC);

ALTER TABLE public.pharmacy_sale_idempotency ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.pharmacy_sale_idempotency IS
  'POS complete-sale idempotency: retries with the same key return the original sale response.';
