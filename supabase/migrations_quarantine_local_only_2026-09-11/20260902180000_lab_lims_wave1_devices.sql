-- Lab Wave 1 durability + Wave 2 device foundation (additive).

-- Result entry provenance for durable reloads
ALTER TABLE public.lab_results
  ADD COLUMN IF NOT EXISTS result_source TEXT
    CHECK (result_source IS NULL OR result_source IN ('MANUAL','ANALYZER','IMPORTED','EXTERNAL')),
  ADD COLUMN IF NOT EXISTS entered_by UUID,
  ADD COLUMN IF NOT EXISTS entered_at TIMESTAMPTZ DEFAULT now();

-- Specimen collection metadata
ALTER TABLE public.lab_specimens
  ADD COLUMN IF NOT EXISTS collected_by UUID,
  ADD COLUMN IF NOT EXISTS container TEXT,
  ADD COLUMN IF NOT EXISTS volume_ml NUMERIC,
  ADD COLUMN IF NOT EXISTS condition TEXT,
  ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS parent_specimen_id UUID,
  ADD COLUMN IF NOT EXISTS storage_location TEXT;

-- Durable accession sequence (facility/day scoped)
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

-- Wave 2: analyzer device registry (Edge talks here; Core never opens serial ports)
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
  connection_type TEXT NOT NULL DEFAULT 'MANUAL'
    CHECK (connection_type IN (
      'SERIAL_RS232','TCP_CLIENT','TCP_SERVER','HL7_MLLP','ASTM',
      'FILE_WATCH','CSV_IMPORT','REST_HTTP','VENDOR_API','MANUAL'
    )),
  protocol TEXT NOT NULL DEFAULT 'NONE',
  host TEXT,
  port INTEGER,
  serial_port TEXT,
  baud_rate INTEGER,
  data_bits INTEGER,
  stop_bits INTEGER,
  parity TEXT,
  flow_control TEXT,
  mode TEXT NOT NULL DEFAULT 'UNIDIRECTIONAL'
    CHECK (mode IN ('UNIDIRECTIONAL','BIDIRECTIONAL')),
  driver TEXT,
  active BOOLEAN NOT NULL DEFAULT false,
  validation_status TEXT NOT NULL DEFAULT 'CONFIGURED'
    CHECK (validation_status IN ('CONFIGURED','CONNECTED','VALIDATION','PILOT','ACTIVE','DECOMMISSIONED')),
  last_seen_at TIMESTAMPTZ,
  last_message_at TIMESTAMPTZ,
  health_status TEXT NOT NULL DEFAULT 'unknown',
  configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
  capabilities JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lab_devices_tenant ON public.lab_devices (tenant_id, active);

-- Immutable raw analyzer messages (prefer over free-form lab_analyzer_messages for pipeline)
CREATE TABLE IF NOT EXISTS public.lab_device_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  device_id UUID REFERENCES public.lab_devices(id) ON DELETE SET NULL,
  direction TEXT NOT NULL DEFAULT 'inbound' CHECK (direction IN ('inbound','outbound')),
  protocol TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  raw_payload TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  message_control_id TEXT,
  parse_status TEXT NOT NULL DEFAULT 'RAW'
    CHECK (parse_status IN ('RAW','PARSED','MAPPED','MATCHED','VALIDATED','FAILED')),
  processing_status TEXT NOT NULL DEFAULT 'RECEIVED'
    CHECK (processing_status IN (
      'RECEIVED','PARSED','MATCHED','UNMATCHED','VALIDATION_FAILED',
      'QC_BLOCKED','READY_FOR_REVIEW','ACCEPTED','REJECTED'
    )),
  error_code TEXT,
  correlation_id TEXT,
  parsed JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_lab_device_messages_dedupe
  ON public.lab_device_messages (tenant_id, payload_hash, (coalesce(message_control_id, '')));

CREATE INDEX IF NOT EXISTS idx_lab_device_messages_device
  ON public.lab_device_messages (device_id, received_at DESC);

-- Analyzer test code → catalogue mapping
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

-- Staged analyzer results (never write released results from parsers)
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
  status TEXT NOT NULL DEFAULT 'RECEIVED'
    CHECK (status IN (
      'RECEIVED','PARSED','MATCHED','UNMATCHED','VALIDATION_FAILED',
      'QC_BLOCKED','READY_FOR_REVIEW','ACCEPTED','REJECTED'
    )),
  correlation_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lab_result_staging_unmatched
  ON public.lab_result_staging (tenant_id, status)
  WHERE status = 'UNMATCHED';

ALTER TABLE public.lab_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_device_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_device_test_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_result_staging ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_accession_counters ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.lab_devices IS
  'Analyzer/device registry. Credentials must be referenced, never stored plaintext in configuration.';
COMMENT ON TABLE public.lab_device_messages IS
  'Immutable raw analyzer traffic. Do not log raw payloads to application logs.';
COMMENT ON TABLE public.lab_result_staging IS
  'Analyzer result staging. Parsers never write released clinical results.';
