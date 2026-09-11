-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260827231431  name: synapse_exchange_pathways_simulation_control
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.

create table if not exists public.pathway_overrides (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  care_plan_id uuid,
  patient_id uuid,
  encounter_id uuid,
  pathway_id text not null,
  pathway_version text not null,
  step_id text not null,
  recommended_action text not null,
  actual_action text not null,
  override_reason text not null,
  clinician_id uuid,
  occurred_at timestamptz not null default now(),
  patient_context_reference text,
  may_train_models boolean not null default false,
  is_synthetic boolean not null default false
);

comment on column public.pathway_overrides.may_train_models is
  'Must remain false unless a separate governance process explicitly permits model use.';

create table if not exists public.clinical_prescriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  pharmacy_tenant_id uuid references public.tenants(id),
  patient_id uuid,
  person_id uuid,
  encounter_id uuid,
  care_plan_id uuid,
  medication_display text not null,
  dose text,
  quantity numeric not null default 1,
  unit text not null default 'unit',
  prescriber_id uuid,
  verifier_id uuid,
  dispenser_id uuid,
  status text not null default 'active'
    check (status in ('active','verified','dispensed','cancelled','returned')),
  hospital_drug_order_id uuid,
  pharmacy_order_id uuid,
  correlation_id uuid,
  is_synthetic boolean not null default false,
  simulation_run_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists clinical_prescriptions_pharm_queue_idx
  on public.clinical_prescriptions (pharmacy_tenant_id, status, created_at desc);

create table if not exists public.synapse_simulation_runs (
  id uuid primary key default gen_random_uuid(),
  seed bigint not null,
  scenario text not null,
  tenant_id uuid not null references public.tenants(id),
  actor_id uuid,
  correlation_id uuid not null,
  status text not null default 'running'
    check (status in ('running','paused','completed','failed')),
  pause_at text,
  is_synthetic boolean not null default true,
  data_classification text not null default 'synthetic',
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists synapse_simulation_runs_tenant_idx
  on public.synapse_simulation_runs (tenant_id, created_at desc);

create table if not exists public.platform_incidents (
  id uuid primary key default gen_random_uuid(),
  service text not null,
  severity text not null check (severity in ('SEV1','SEV2','SEV3','SEV4')),
  status text not null default 'INVESTIGATING'
    check (status in ('INVESTIGATING','IDENTIFIED','MONITORING','RESOLVED')),
  impact text,
  started_at timestamptz not null default now(),
  resolved_at timestamptz,
  root_cause_reference text,
  updates jsonb not null default '[]'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.platform_health_checks (
  id uuid primary key default gen_random_uuid(),
  target text not null,
  check_type text not null default 'http',
  status text not null
    check (status in ('healthy','degraded','down','not_connected','not_configured')),
  http_status integer,
  latency_ms integer,
  detail text,
  checked_at timestamptz not null default now()
);

create table if not exists public.platform_module_matrix (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  module_key text not null,
  state text not null default 'Disabled'
    check (state in ('Enabled','Disabled','Pilot','Demo','Development','Unsupported')),
  updated_at timestamptz not null default now(),
  unique (tenant_id, module_key)
);
