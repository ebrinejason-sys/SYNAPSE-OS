-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260828165013  name: domain_event_log
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.

-- Wave-1 append-only domain_events (publish.ts / clinical trace). Coexists with synapse_domain_events.
CREATE TABLE IF NOT EXISTS public.domain_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL UNIQUE,
  event_type text NOT NULL,
  event_version integer NOT NULL DEFAULT 1,
  occurred_at timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  producer text NOT NULL,
  correlation_id uuid NOT NULL,
  causation_id uuid,
  tenant_id uuid,
  facility_id uuid,
  patient_id uuid,
  encounter_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  payload_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_domain_events_event_id ON public.domain_events (event_id);
CREATE INDEX IF NOT EXISTS idx_domain_events_correlation ON public.domain_events (correlation_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_domain_events_facility_time ON public.domain_events (facility_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_domain_events_patient_time ON public.domain_events (patient_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_domain_events_type_time ON public.domain_events (event_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_domain_events_encounter ON public.domain_events (encounter_id, occurred_at DESC);

DROP TRIGGER IF EXISTS trg_domain_events_updated_at ON public.domain_events;
CREATE TRIGGER trg_domain_events_updated_at
  BEFORE UPDATE ON public.domain_events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.domain_events ENABLE ROW LEVEL SECURITY;
