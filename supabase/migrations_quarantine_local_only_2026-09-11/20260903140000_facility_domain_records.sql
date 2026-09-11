-- Facility domain health / provisioning evidence (no Vercel tokens).

CREATE TABLE IF NOT EXISTS public.facility_domain_records (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  facility_id       UUID,
  hostname          TEXT NOT NULL,
  domain_type       TEXT NOT NULL DEFAULT 'synapse_subdomain'
                    CHECK (domain_type IN (
                      'synapse_subdomain',
                      'pharmacy_login',
                      'pharmacy_subdomain',
                      'custom'
                    )),
  target_project    TEXT,
  status            TEXT NOT NULL DEFAULT 'NOT_REQUESTED'
                    CHECK (status IN (
                      'NOT_REQUESTED',
                      'REQUESTED',
                      'PROVISIONING',
                      'DNS_PENDING',
                      'VERIFIED',
                      'ACTIVE',
                      'ERROR'
                    )),
  verified_at       TIMESTAMPTZ,
  last_checked_at   TIMESTAMPTZ,
  safe_error        TEXT,
  verification_requirements JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (hostname)
);

CREATE INDEX IF NOT EXISTS idx_facility_domain_records_tenant
  ON public.facility_domain_records (tenant_id, status);

ALTER TABLE public.facility_domain_records ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.facility_domain_records IS
  'Domain provisioning evidence for facilities. Never store Vercel bearer tokens.';
