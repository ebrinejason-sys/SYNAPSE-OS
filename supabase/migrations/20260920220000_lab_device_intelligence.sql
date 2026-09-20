-- Lab device intelligence: heartbeat columns, hashed bridge credentials, validation failure states.
-- Does not rewrite historical lab_results or replace instrument ingest.

ALTER TABLE public.lab_instrument_bridges
  ADD COLUMN IF NOT EXISTS device_id UUID REFERENCES public.lab_devices(id),
  ADD COLUMN IF NOT EXISTS api_key_hash TEXT,
  ADD COLUMN IF NOT EXISTS api_key_prefix TEXT,
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS edge_version TEXT,
  ADD COLUMN IF NOT EXISTS service_state TEXT,
  ADD COLUMN IF NOT EXISTS queue_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS last_successful_upload TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS heartbeat_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_lab_instrument_bridges_hash
  ON public.lab_instrument_bridges (tenant_id, api_key_hash)
  WHERE api_key_hash IS NOT NULL AND revoked_at IS NULL;

ALTER TABLE public.lab_device_messages
  ADD COLUMN IF NOT EXISTS parser_version TEXT,
  ADD COLUMN IF NOT EXISTS parse_error TEXT;

ALTER TABLE public.lab_devices
  ADD COLUMN IF NOT EXISTS section TEXT,
  ADD COLUMN IF NOT EXISTS mapping_profile TEXT;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lab_devices_validation_status_check') THEN
    ALTER TABLE public.lab_devices DROP CONSTRAINT lab_devices_validation_status_check;
  END IF;
  ALTER TABLE public.lab_devices
    ADD CONSTRAINT lab_devices_validation_status_check
    CHECK (validation_status IN (
      'CONFIGURED','CONNECTED','VALIDATION','PILOT','ACTIVE','SUSPENDED','ERROR','DECOMMISSIONED'
    ));
END $$;

ALTER TABLE public.lab_device_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_device_test_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_result_staging ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant isolation for lab devices" ON public.lab_devices;
CREATE POLICY "Tenant isolation for lab devices" ON public.lab_devices
  FOR ALL USING (tenant_id = current_tenant_id() OR is_platform_admin())
  WITH CHECK (tenant_id = current_tenant_id() OR is_platform_admin());

DROP POLICY IF EXISTS "Tenant isolation for lab device messages" ON public.lab_device_messages;
CREATE POLICY "Tenant isolation for lab device messages" ON public.lab_device_messages
  FOR ALL USING (tenant_id = current_tenant_id() OR is_platform_admin())
  WITH CHECK (tenant_id = current_tenant_id() OR is_platform_admin());

DROP POLICY IF EXISTS "Tenant isolation for lab device mappings" ON public.lab_device_test_mappings;
CREATE POLICY "Tenant isolation for lab device mappings" ON public.lab_device_test_mappings
  FOR ALL USING (tenant_id = current_tenant_id() OR is_platform_admin())
  WITH CHECK (tenant_id = current_tenant_id() OR is_platform_admin());

DROP POLICY IF EXISTS "Tenant isolation for lab result staging" ON public.lab_result_staging;
CREATE POLICY "Tenant isolation for lab result staging" ON public.lab_result_staging
  FOR ALL USING (tenant_id = current_tenant_id() OR is_platform_admin())
  WITH CHECK (tenant_id = current_tenant_id() OR is_platform_admin());

COMMENT ON COLUMN public.lab_instrument_bridges.api_key_hash IS
  'SHA-256 of the presented Lab Edge secret. Responses must never return the secret.';

ALTER TABLE public.lab_results
  ADD COLUMN IF NOT EXISTS critical_scientist_ack_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS critical_scientist_ack_by UUID,
  ADD COLUMN IF NOT EXISTS critical_clinician_ack_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS critical_clinician_ack_by UUID;

-- Canonical bootstrap dump still describes the pre-heartbeat bridge columns.
-- Forward migration is the source of truth until the next dump refresh.
