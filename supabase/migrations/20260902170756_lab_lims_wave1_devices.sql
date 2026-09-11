-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260902170756  name: lab_lims_wave1_devices
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.

-- Applied from 20260902180000_lab_lims_wave1_devices.sql (abbreviated apply via MCP)
ALTER TABLE public.lab_results
  ADD COLUMN IF NOT EXISTS result_source TEXT,
  ADD COLUMN IF NOT EXISTS entered_by UUID,
  ADD COLUMN IF NOT EXISTS entered_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.lab_specimens
  ADD COLUMN IF NOT EXISTS collected_by UUID,
  ADD COLUMN IF NOT EXISTS container TEXT,
  ADD COLUMN IF NOT EXISTS volume_ml NUMERIC,
  ADD COLUMN IF NOT EXISTS condition TEXT,
  ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS parent_specimen_id UUID,
  ADD COLUMN IF NOT EXISTS storage_location TEXT;

CREATE TABLE IF NOT EXISTS public.lab_accession_counters (
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  facility_code TEXT NOT NULL,
  day_key TEXT NOT NULL,
  last_value INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, facility_code, day_key)
);

CREATE OR REPLACE FUNCTION public.allocate_lab_accession(
  p_tenant_id UUID,
  p_facility_code TEXT,
  p_day TEXT
) RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_next INTEGER;
BEGIN
  INSERT INTO public.lab_accession_counters (tenant_id, facility_code, day_key, last_value)
  VALUES (p_tenant_id, upper(p_facility_code), p_day, 1)
  ON CONFLICT (tenant_id, facility_code, day_key)
  DO UPDATE SET last_value = public.lab_accession_counters.last_value + 1
  RETURNING last_value INTO v_next;
  RETURN upper(p_facility_code) || '-' || p_day || '-' || lpad(v_next::text, 6, '0');
END;
$$;

REVOKE ALL ON FUNCTION public.allocate_lab_accession(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.allocate_lab_accession(UUID, TEXT, TEXT) TO service_role;

CREATE TABLE IF NOT EXISTS public.lab_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  facility_id UUID,
  name TEXT NOT NULL,
  manufacturer TEXT,
  model TEXT,
  serial_number TEXT,
  device_type TEXT NOT NULL DEFAULT 'analyzer',
  discipline TEXT,
  connection_type TEXT NOT NULL DEFAULT 'MANUAL',
  protocol TEXT NOT NULL DEFAULT 'NONE',
  host TEXT,
  port INTEGER,
  serial_port TEXT,
  baud_rate INTEGER,
  data_bits INTEGER,
  stop_bits INTEGER,
  parity TEXT,
  flow_control TEXT,
  mode TEXT NOT NULL DEFAULT 'UNIDIRECTIONAL',
  driver TEXT,
  active BOOLEAN NOT NULL DEFAULT false,
  validation_status TEXT NOT NULL DEFAULT 'CONFIGURED',
  last_seen_at TIMESTAMPTZ,
  last_message_at TIMESTAMPTZ,
  health_status TEXT NOT NULL DEFAULT 'unknown',
  configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
  capabilities JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lab_devices_tenant ON public.lab_devices (tenant_id, active);

CREATE TABLE IF NOT EXISTS public.lab_device_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  device_id UUID REFERENCES public.lab_devices(id) ON DELETE SET NULL,
  direction TEXT NOT NULL DEFAULT 'inbound',
  protocol TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  raw_payload TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  message_control_id TEXT,
  parse_status TEXT NOT NULL DEFAULT 'RAW',
  processing_status TEXT NOT NULL DEFAULT 'RECEIVED',
  error_code TEXT,
  correlation_id TEXT,
  parsed JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_lab_device_messages_dedupe
  ON public.lab_device_messages (tenant_id, payload_hash, (coalesce(message_control_id, '')));

CREATE TABLE IF NOT EXISTS public.lab_device_test_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  device_id UUID NOT NULL REFERENCES public.lab_devices(id) ON DELETE CASCADE,
  analyzer_code TEXT NOT NULL,
  analyzer_name TEXT,
  catalog_test_id TEXT,
  component_id TEXT,
  loinc_code TEXT,
  unit TEXT,
  conversion_factor NUMERIC NOT NULL DEFAULT 1,
  conversion_offset NUMERIC NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (device_id, analyzer_code)
);

CREATE TABLE IF NOT EXISTS public.lab_result_staging (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  device_id UUID REFERENCES public.lab_devices(id),
  device_message_id UUID REFERENCES public.lab_device_messages(id),
  lab_order_id UUID,
  specimen_id UUID,
  accession_number TEXT,
  analyzer_code TEXT,
  mapped_loinc TEXT,
  mapped_test_name TEXT,
  value TEXT,
  unit TEXT,
  flags JSONB NOT NULL DEFAULT '{}'::jsonb,
  instrument_flags JSONB NOT NULL DEFAULT '{}'::jsonb,
  run_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'RECEIVED',
  correlation_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.lab_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_device_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_device_test_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_result_staging ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_accession_counters ENABLE ROW LEVEL SECURITY;
