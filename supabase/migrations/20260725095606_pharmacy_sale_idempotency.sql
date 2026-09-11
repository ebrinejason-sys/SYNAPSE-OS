-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260725095606  name: pharmacy_sale_idempotency
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.

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
