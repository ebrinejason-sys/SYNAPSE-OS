-- DHIS2 Phase 0–1: aggregate export jobs, attempt log, optional mappings.
-- Additive. Outbound-only; never stores identifiable patient packets.

CREATE TABLE IF NOT EXISTS public.dhis2_export_jobs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  facility_id      UUID,
  status           TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'running', 'succeeded', 'failed', 'dead')),
  mode             TEXT NOT NULL DEFAULT 'simulation'
                   CHECK (mode IN ('live', 'simulation')),
  period           TEXT NOT NULL,
  org_unit         TEXT NOT NULL,
  data_set         TEXT,
  payload          JSONB NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key  TEXT NOT NULL,
  attempt_count    INTEGER NOT NULL DEFAULT 0,
  last_error       TEXT,
  is_synthetic     BOOLEAN NOT NULL DEFAULT false,
  created_by       UUID,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at       TIMESTAMPTZ,
  completed_at     TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_dhis2_export_jobs_idempotency
  ON public.dhis2_export_jobs (tenant_id, idempotency_key);

CREATE INDEX IF NOT EXISTS idx_dhis2_export_jobs_status
  ON public.dhis2_export_jobs (status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.dhis2_export_attempt_log (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id             UUID REFERENCES public.dhis2_export_jobs(id) ON DELETE SET NULL,
  tenant_id          UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  status             TEXT NOT NULL,
  mode               TEXT NOT NULL DEFAULT 'simulation',
  records_exported   INTEGER NOT NULL DEFAULT 0,
  message            TEXT,
  metadata           JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dhis2_export_attempt_log_job
  ON public.dhis2_export_attempt_log (job_id, created_at DESC);

-- Legacy monitor table used by /platform/dhis2 (create if missing)
CREATE TABLE IF NOT EXISTS public.dhis2_export_log (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  export_date        DATE,
  records_exported   INTEGER NOT NULL DEFAULT 0,
  status             TEXT,
  error_message      TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  job_id             UUID REFERENCES public.dhis2_export_jobs(id) ON DELETE SET NULL
);

ALTER TABLE public.dhis2_export_log
  ADD COLUMN IF NOT EXISTS job_id UUID REFERENCES public.dhis2_export_jobs(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.dhis2_org_unit_mappings (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  facility_id        UUID,
  local_org_key      TEXT NOT NULL,
  dhis2_org_unit_id  TEXT NOT NULL,
  display_name       TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, local_org_key)
);

CREATE TABLE IF NOT EXISTS public.dhis2_data_element_mappings (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  icd11_stem_code         TEXT NOT NULL,
  dhis2_data_element_id   TEXT NOT NULL,
  display_name            TEXT,
  hmis_code               TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_dhis2_de_map_stem
  ON public.dhis2_data_element_mappings (COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), icd11_stem_code);

ALTER TABLE public.dhis2_export_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dhis2_export_attempt_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dhis2_export_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dhis2_org_unit_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dhis2_data_element_mappings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'dhis2_export_jobs' AND policyname = 'dhis2_export_jobs_tenant_isolation'
  ) THEN
    CREATE POLICY dhis2_export_jobs_tenant_isolation ON public.dhis2_export_jobs
      FOR ALL
      USING (tenant_id = (current_setting('request.jwt.claims', true)::json->>'tenant_id')::uuid)
      WITH CHECK (tenant_id = (current_setting('request.jwt.claims', true)::json->>'tenant_id')::uuid);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'dhis2_export_attempt_log' AND policyname = 'dhis2_export_attempt_log_tenant_isolation'
  ) THEN
    CREATE POLICY dhis2_export_attempt_log_tenant_isolation ON public.dhis2_export_attempt_log
      FOR ALL
      USING (tenant_id = (current_setting('request.jwt.claims', true)::json->>'tenant_id')::uuid)
      WITH CHECK (tenant_id = (current_setting('request.jwt.claims', true)::json->>'tenant_id')::uuid);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'dhis2_org_unit_mappings' AND policyname = 'dhis2_org_unit_mappings_tenant_isolation'
  ) THEN
    CREATE POLICY dhis2_org_unit_mappings_tenant_isolation ON public.dhis2_org_unit_mappings
      FOR ALL
      USING (tenant_id = (current_setting('request.jwt.claims', true)::json->>'tenant_id')::uuid)
      WITH CHECK (tenant_id = (current_setting('request.jwt.claims', true)::json->>'tenant_id')::uuid);
  END IF;
END $$;

COMMENT ON TABLE public.dhis2_export_jobs IS
  'Outbound DHIS2 aggregate DataValueSet jobs. Payload is privacy-gated counts only — never PatientContextPacket.';
COMMENT ON TABLE public.dhis2_export_attempt_log IS
  'Append-only attempt audit for DHIS2 aggregate exports.';
