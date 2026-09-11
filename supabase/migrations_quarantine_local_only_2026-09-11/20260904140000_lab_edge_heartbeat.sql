ALTER TABLE public.lab_instrument_bridges
  ADD COLUMN IF NOT EXISTS edge_version TEXT,
  ADD COLUMN IF NOT EXISTS service_state TEXT,
  ADD COLUMN IF NOT EXISTS queue_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS last_successful_upload TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS heartbeat_at TIMESTAMPTZ;