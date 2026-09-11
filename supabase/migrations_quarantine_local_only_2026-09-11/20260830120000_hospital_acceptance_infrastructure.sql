-- Hospital Acceptance Infrastructure
-- facility_locations, department_tasks (WorkQueue), hospital_seed_registry
-- Supports SYNAPSE INTEGRATED REGIONAL HOSPITAL acceptance milestone.

-- ── Facility locations (structured, not free text) ──────────────────────────

CREATE TABLE IF NOT EXISTS public.facility_locations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  hospital_id     UUID REFERENCES public.hospitals(id) ON DELETE SET NULL,
  department_id   UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  parent_id       UUID REFERENCES public.facility_locations(id) ON DELETE SET NULL,
  code            TEXT NOT NULL,
  name            TEXT NOT NULL,
  location_type   TEXT NOT NULL DEFAULT 'room',
  floor           INTEGER,
  building        TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  is_synthetic    BOOLEAN NOT NULL DEFAULT false,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code)
);

CREATE INDEX IF NOT EXISTS idx_facility_locations_tenant
  ON public.facility_locations (tenant_id);
CREATE INDEX IF NOT EXISTS idx_facility_locations_department
  ON public.facility_locations (department_id);
CREATE INDEX IF NOT EXISTS idx_facility_locations_parent
  ON public.facility_locations (parent_id);

-- ── Interdepartment task / work queue ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.department_tasks (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  facility_id       UUID,
  hospital_id       UUID REFERENCES public.hospitals(id) ON DELETE SET NULL,
  patient_id        UUID REFERENCES public.patients(id) ON DELETE SET NULL,
  person_id         UUID,
  encounter_id      UUID,
  requester_id      UUID,
  owner_department  TEXT NOT NULL,
  owner_role        TEXT,
  task_type         TEXT NOT NULL,
  priority          TEXT NOT NULL DEFAULT 'ROUTINE',
  status            TEXT NOT NULL DEFAULT 'REQUESTED',
  title             TEXT NOT NULL,
  description       TEXT,
  source_resource   TEXT,
  source_id         UUID,
  correlation_id    UUID,
  causation_id      UUID,
  idempotency_key   TEXT,
  due_at            TIMESTAMPTZ,
  accepted_at       TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  cancelled_at      TIMESTAMPTZ,
  assigned_to       UUID,
  result_summary    TEXT,
  metadata          JSONB DEFAULT '{}',
  is_synthetic      BOOLEAN NOT NULL DEFAULT false,
  simulation_run_id UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT department_tasks_status_check CHECK (
    status IN ('REQUESTED','ACCEPTED','IN_PROGRESS','ON_HOLD','COMPLETED','CANCELLED','FAILED')
  ),
  CONSTRAINT department_tasks_priority_check CHECK (
    priority IN ('STAT','URGENT','ROUTINE','LOW')
  )
);

CREATE INDEX IF NOT EXISTS idx_department_tasks_tenant_status
  ON public.department_tasks (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_department_tasks_owner_dept
  ON public.department_tasks (tenant_id, owner_department, status);
CREATE INDEX IF NOT EXISTS idx_department_tasks_patient
  ON public.department_tasks (patient_id);
CREATE INDEX IF NOT EXISTS idx_department_tasks_encounter
  ON public.department_tasks (encounter_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_department_tasks_idempotency
  ON public.department_tasks (tenant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- ── Hospital seed registry (idempotent synthetic provisioning) ───────────────

CREATE TABLE IF NOT EXISTS public.hospital_seed_registry (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  hospital_id           UUID REFERENCES public.hospitals(id) ON DELETE SET NULL,
  slug                  TEXT NOT NULL UNIQUE,
  seed                  BIGINT NOT NULL,
  seed_version          TEXT NOT NULL DEFAULT '20260830',
  environment           TEXT NOT NULL DEFAULT 'demo',
  is_synthetic          BOOLEAN NOT NULL DEFAULT true,
  data_classification   TEXT NOT NULL DEFAULT 'synthetic',
  protected_flags       JSONB NOT NULL DEFAULT '{"reporting":true,"claims":true,"notifications":true}',
  department_count      INTEGER DEFAULT 0,
  location_count        INTEGER DEFAULT 0,
  staff_count           INTEGER DEFAULT 0,
  patient_count         INTEGER DEFAULT 0,
  last_seeded_at        TIMESTAMPTZ,
  last_reset_at         TIMESTAMPTZ,
  snapshot              JSONB DEFAULT '{}',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hospital_seed_registry_tenant
  ON public.hospital_seed_registry (tenant_id);

-- ── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.facility_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.department_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospital_seed_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY facility_locations_tenant_isolation ON public.facility_locations
  FOR ALL USING (tenant_id = public.current_tenant_id());

CREATE POLICY department_tasks_tenant_isolation ON public.department_tasks
  FOR ALL USING (tenant_id = public.current_tenant_id());

CREATE POLICY hospital_seed_registry_tenant_isolation ON public.hospital_seed_registry
  FOR ALL USING (tenant_id = public.current_tenant_id());

CREATE POLICY hospital_seed_registry_platform_read ON public.hospital_seed_registry
  FOR SELECT USING (public.is_platform_admin());
