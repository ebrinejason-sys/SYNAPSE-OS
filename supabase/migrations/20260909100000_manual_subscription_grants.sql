-- Platform-admin entitlement overrides. These never mutate payment or paid subscription rows.
CREATE TABLE IF NOT EXISTS public.subscription_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_type TEXT NOT NULL CHECK (subject_type IN ('USER','TENANT','FACILITY','PHARMACY','LABORATORY','CLINIC','HOSPITAL','ORGANIZATION')),
  subject_id UUID NOT NULL,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  facility_id UUID,
  plan_id UUID REFERENCES public.subscription_plans(id) ON DELETE SET NULL,
  grant_type TEXT NOT NULL DEFAULT 'MANUAL' CHECK (grant_type IN ('MANUAL','TRIAL','PROMOTIONAL','COMPASSIONATE','STAFF','PARTNER','PILOT','OTHER')),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED','ACTIVE','EXPIRED','REVOKED','CANCELLED')),
  reason TEXT NOT NULL,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  approved_by UUID REFERENCES public.profiles(id),
  source TEXT NOT NULL DEFAULT 'PLATFORM_ADMIN',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES public.profiles(id),
  revoke_reason TEXT,
  idempotency_key TEXT,
  CHECK (ends_at > starts_at)
);

CREATE UNIQUE INDEX IF NOT EXISTS subscription_grants_idempotency_idx
  ON public.subscription_grants(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS subscription_grants_subject_idx ON public.subscription_grants(subject_type, subject_id, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS subscription_grants_tenant_idx ON public.subscription_grants(tenant_id, status, ends_at);
CREATE INDEX IF NOT EXISTS subscription_grants_active_idx ON public.subscription_grants(status, starts_at, ends_at);

ALTER TABLE public.subscription_grants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Subscription grants tenant isolation" ON public.subscription_grants
  FOR SELECT USING (tenant_id = current_tenant_id() OR is_platform_admin());
CREATE POLICY "Subscription grants platform writes" ON public.subscription_grants
  FOR ALL USING (is_platform_admin()) WITH CHECK (is_platform_admin());

COMMENT ON TABLE public.subscription_grants IS
  'Manual entitlement grants. Grants do not represent payments and never modify subscription_payments.';