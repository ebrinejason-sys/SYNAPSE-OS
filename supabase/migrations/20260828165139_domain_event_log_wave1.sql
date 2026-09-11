-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260828165139  name: domain_event_log_wave1
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.

-- Replace the empty thin domain_events table with the Wave-1 outbox the app inserts into.
DROP TABLE IF EXISTS public.domain_event_consumers CASCADE;
DROP TABLE IF EXISTS public.domain_events CASCADE;

CREATE TABLE public.domain_events (
  event_id           text        PRIMARY KEY,
  event_type         text        NOT NULL,
  event_version      integer     NOT NULL DEFAULT 1 CHECK (event_version > 0),
  schema_version     integer     NOT NULL DEFAULT 1 CHECK (schema_version > 0),

  tenant_id          uuid        NOT NULL REFERENCES public.hospitals (id) ON DELETE CASCADE,
  facility_id        uuid        REFERENCES public.hospitals (id) ON DELETE SET NULL,
  patient_id         uuid        REFERENCES public.patients (id) ON DELETE SET NULL,
  encounter_id       uuid        REFERENCES public.encounters (id) ON DELETE SET NULL,

  actor_id           uuid        REFERENCES public.profiles (id) ON DELETE SET NULL,
  actor_type         text        NOT NULL
    CHECK (actor_type IN ('human', 'system', 'adapter', 'intelligence', 'device')),
  source_module      text        NOT NULL
    CHECK (source_module IN (
      'core', 'clinical', 'pathways', 'intelligence', 'terminology', 'lab',
      'pharmacy', 'imaging', 'insurance', 'exchange', 'publichealth', 'edge',
      'platform', 'timeline'
    )),
  source_system      text        NOT NULL DEFAULT 'synapse',

  correlation_id     text        NOT NULL,
  causation_id       text,
  idempotency_key    text        NOT NULL,

  occurred_at        timestamptz NOT NULL,
  recorded_at        timestamptz NOT NULL DEFAULT timezone('utc', now()),

  payload            jsonb       NOT NULL DEFAULT '{}',

  processing_status  text        NOT NULL DEFAULT 'pending'
    CHECK (processing_status IN ('pending', 'processing', 'processed', 'failed', 'dead_lettered', 'skipped')),
  attempts           integer     NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error         text,
  processed_at       timestamptz,
  next_attempt_at    timestamptz,

  created_at         timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at         timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_domain_events_idempotency
  ON public.domain_events (tenant_id, event_type, idempotency_key);

CREATE INDEX IF NOT EXISTS idx_domain_events_pending
  ON public.domain_events (processing_status, next_attempt_at ASC, recorded_at ASC)
  WHERE processing_status IN ('pending', 'failed');

CREATE INDEX IF NOT EXISTS idx_domain_events_correlation
  ON public.domain_events (correlation_id, occurred_at ASC);

CREATE INDEX IF NOT EXISTS idx_domain_events_patient
  ON public.domain_events (patient_id, occurred_at DESC)
  WHERE patient_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_domain_events_encounter
  ON public.domain_events (encounter_id, occurred_at ASC)
  WHERE encounter_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_domain_events_type_tenant
  ON public.domain_events (tenant_id, event_type, occurred_at DESC);

DROP TRIGGER IF EXISTS trg_domain_events_updated_at ON public.domain_events;
CREATE TRIGGER trg_domain_events_updated_at
BEFORE UPDATE ON public.domain_events
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.domain_event_consumers (
  consumer_id        text        NOT NULL,
  tenant_id          uuid        NOT NULL REFERENCES public.hospitals (id) ON DELETE CASCADE,
  checkpoint_at      timestamptz NOT NULL DEFAULT timezone('utc', now()),
  last_event_id      text        REFERENCES public.domain_events (event_id) ON DELETE SET NULL,
  status             text        NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'failed')),
  lag_seconds        integer,
  last_error         text,
  updated_at         timestamptz NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (consumer_id, tenant_id)
);

DROP TRIGGER IF EXISTS trg_domain_event_consumers_updated_at ON public.domain_event_consumers;
CREATE TRIGGER trg_domain_event_consumers_updated_at
BEFORE UPDATE ON public.domain_event_consumers
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.domain_events           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.domain_event_consumers  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS domain_events_service_write ON public.domain_events;
CREATE POLICY domain_events_service_write ON public.domain_events
FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS domain_events_tenant_read ON public.domain_events;
CREATE POLICY domain_events_tenant_read ON public.domain_events
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.hospital_id = public.domain_events.tenant_id
  )
);

DROP POLICY IF EXISTS domain_event_consumers_service_write ON public.domain_event_consumers;
CREATE POLICY domain_event_consumers_service_write ON public.domain_event_consumers
FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS domain_event_consumers_tenant_read ON public.domain_event_consumers;
CREATE POLICY domain_event_consumers_tenant_read ON public.domain_event_consumers
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.hospital_id = public.domain_event_consumers.tenant_id
  )
);
