-- Hospital onboarding: hospitals profile + module registry rows.
-- Additive. Unblocks POST /api/platform/hospitals and acceptance FKs.

CREATE TABLE IF NOT EXISTS public.hospitals (
  id          UUID PRIMARY KEY,
  name        TEXT NOT NULL,
  subdomain   TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'general',
  settings    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_hospitals_subdomain
  ON public.hospitals (subdomain);

CREATE TABLE IF NOT EXISTS public.hospital_modules (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id   UUID REFERENCES public.hospitals(id) ON DELETE CASCADE,
  tenant_id     UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  module_key    TEXT NOT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  activated_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (hospital_id, module_key)
);

CREATE INDEX IF NOT EXISTS idx_hospital_modules_tenant
  ON public.hospital_modules (tenant_id, module_key);

-- Align departments with hospital provisioning API (dept_type, hospital_id).
ALTER TABLE public.departments
  ADD COLUMN IF NOT EXISTS hospital_id UUID REFERENCES public.hospitals(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS dept_type TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.hospitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospital_modules ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'hospitals' AND policyname = 'hospitals_tenant_isolation'
  ) THEN
    CREATE POLICY hospitals_tenant_isolation ON public.hospitals
      FOR ALL
      USING (
        id = (current_setting('request.jwt.claims', true)::json->>'tenant_id')::uuid
        OR EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.role = 'platform_admin'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'hospital_modules' AND policyname = 'hospital_modules_tenant_isolation'
  ) THEN
    CREATE POLICY hospital_modules_tenant_isolation ON public.hospital_modules
      FOR ALL
      USING (
        tenant_id = (current_setting('request.jwt.claims', true)::json->>'tenant_id')::uuid
        OR EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.role = 'platform_admin'
        )
      );
  END IF;
END $$;

-- Public lead capture: allow anonymous INSERT only (no read/update).
DROP POLICY IF EXISTS hospital_leads_public_insert ON public.hospital_leads;
CREATE POLICY hospital_leads_public_insert ON public.hospital_leads
  FOR INSERT
  WITH CHECK (status = 'new');

COMMENT ON TABLE public.hospitals IS
  'Hospital facility profile (1:1 with tenant id for platform-provisioned hospitals).';
COMMENT ON TABLE public.hospital_modules IS
  'Per-hospital module activation registry.';
