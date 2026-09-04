-- Runtime feature flags used by platform controls and facility provisioning.
CREATE TABLE IF NOT EXISTS public.feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  enabled_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  enabled_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS feature_flags_tenant_key_unique
  ON public.feature_flags (tenant_id, feature_key)
  WHERE tenant_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS feature_flags_global_key_unique
  ON public.feature_flags (feature_key)
  WHERE tenant_id IS NULL;

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.feature_flags IS
  'Tenant and global runtime feature flags managed by platform administrators.';