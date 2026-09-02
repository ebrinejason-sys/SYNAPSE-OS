-- Facility provisioning runs + steps + invitations (hospital onboarding production path).
-- Additive. Explicit step status — no silent failures.

CREATE TABLE IF NOT EXISTS public.facility_provisioning_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  hospital_id     UUID,
  created_by      UUID,
  mode            TEXT NOT NULL DEFAULT 'REAL'
                  CHECK (mode IN ('REAL', 'SYNTHETIC_ACCEPTANCE')),
  status          TEXT NOT NULL DEFAULT 'PENDING'
                  CHECK (status IN (
                    'PENDING', 'RUNNING', 'COMPLETE', 'FAILED',
                    'READY_WITH_WARNINGS', 'ROLLED_BACK'
                  )),
  current_step    TEXT,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  failed_at       TIMESTAMPTZ,
  failure_code    TEXT,
  correlation_id  TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  slug            TEXT NOT NULL,
  facility_name   TEXT NOT NULL,
  ownership       TEXT,
  facility_level  TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_facility_provisioning_runs_idempotency
  ON public.facility_provisioning_runs (idempotency_key);

CREATE INDEX IF NOT EXISTS idx_facility_provisioning_runs_slug
  ON public.facility_provisioning_runs (slug, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_facility_provisioning_runs_tenant
  ON public.facility_provisioning_runs (tenant_id);

CREATE TABLE IF NOT EXISTS public.facility_provisioning_steps (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id             UUID NOT NULL REFERENCES public.facility_provisioning_runs(id) ON DELETE CASCADE,
  step               TEXT NOT NULL,
  status             TEXT NOT NULL DEFAULT 'PENDING'
                     CHECK (status IN (
                       'PENDING', 'RUNNING', 'COMPLETE', 'FAILED', 'SKIPPED', 'ROLLED_BACK'
                     )),
  started_at         TIMESTAMPTZ,
  completed_at       TIMESTAMPTZ,
  error_code         TEXT,
  safe_error_message TEXT,
  attempt_count      INTEGER NOT NULL DEFAULT 0,
  evidence           JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (run_id, step)
);

CREATE INDEX IF NOT EXISTS idx_facility_provisioning_steps_run
  ON public.facility_provisioning_steps (run_id, step);

CREATE TABLE IF NOT EXISTS public.facility_invitations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  run_id           UUID REFERENCES public.facility_provisioning_runs(id) ON DELETE SET NULL,
  email            TEXT NOT NULL,
  full_name        TEXT,
  role             TEXT NOT NULL DEFAULT 'hospital_admin',
  invite_token     TEXT NOT NULL UNIQUE,
  status           TEXT NOT NULL DEFAULT 'PENDING'
                   CHECK (status IN (
                     'PENDING', 'SENT', 'ACCEPTED', 'EXPIRED', 'FAILED', 'REVOKED'
                   )),
  expires_at       TIMESTAMPTZ NOT NULL,
  sent_at          TIMESTAMPTZ,
  accepted_at      TIMESTAMPTZ,
  revoked_at       TIMESTAMPTZ,
  last_error       TEXT,
  profile_id       UUID,
  created_by       UUID,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_facility_invitations_tenant
  ON public.facility_invitations (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_facility_invitations_token
  ON public.facility_invitations (invite_token);

-- Structured facility locations (if missing from acceptance migration)
CREATE TABLE IF NOT EXISTS public.facility_locations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  hospital_id     UUID,
  department_id   UUID,
  code            TEXT NOT NULL,
  name            TEXT NOT NULL,
  location_type   TEXT NOT NULL DEFAULT 'room',
  parent_id       UUID,
  floor           INTEGER,
  building        TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  is_synthetic    BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code)
);

ALTER TABLE public.facility_provisioning_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facility_provisioning_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facility_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facility_locations ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.facility_provisioning_runs IS
  'Hospital/facility onboarding runs with explicit step status. Modes: REAL | SYNTHETIC_ACCEPTANCE.';
COMMENT ON TABLE public.facility_provisioning_steps IS
  'Per-step provisioning audit: PENDING|RUNNING|COMPLETE|FAILED|SKIPPED|ROLLED_BACK.';
COMMENT ON TABLE public.facility_invitations IS
  'Single-use expiring hospital admin invitations (custom Synapse auth).';
