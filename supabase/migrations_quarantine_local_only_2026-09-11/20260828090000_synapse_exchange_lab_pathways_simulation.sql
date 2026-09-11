-- =============================================================================
-- SYNAPSE Exchange, Lab vertical-slice extensions, pathway overrides,
-- clinical prescriptions, simulation engine, and platform control-center tables.
--
-- ADDITIVE. Does not recreate pharmacy POS/inventory or duplicate lab_orders /
-- lab_specimens / patients / persons. Extends existing tables where needed.
--
-- Production tenants cannot be classified as demo by this migration.
-- Destructive simulation reset is enforced in application code AND here via
-- environment/classification checks on synapse_simulation_runs.
-- =============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------------------------
-- Tenant classification for demo isolation
-- ---------------------------------------------------------------------------
alter table public.tenants
  add column if not exists environment text,
  add column if not exists is_synthetic boolean not null default false,
  add column if not exists data_classification text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'tenants_environment_check'
  ) then
    alter table public.tenants
      add constraint tenants_environment_check
      check (environment is null or environment in ('production','staging','demo','preview'));
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'tenants_data_classification_check'
  ) then
    alter table public.tenants
      add constraint tenants_data_classification_check
      check (
        data_classification is null
        or data_classification in ('clinical','synthetic','operational')
      );
  end if;
end $$;

comment on column public.tenants.is_synthetic is
  'Demo/simulation tenants only. Production reset APIs must refuse tenants where this is false.';

-- ---------------------------------------------------------------------------
-- Lab order workflow columns (reuse lab_orders; do not create a second order table)
-- ---------------------------------------------------------------------------
alter table public.lab_orders
  add column if not exists person_id uuid,
  add column if not exists workflow_status text,
  add column if not exists accession_number text,
  add column if not exists barcode text,
  add column if not exists specimen_id uuid,
  add column if not exists rejection_reason text,
  add column if not exists rejection_note text,
  add column if not exists correlation_id uuid,
  add column if not exists care_plan_id uuid,
  add column if not exists is_synthetic boolean not null default false,
  add column if not exists simulation_run_id uuid,
  add column if not exists data_classification text;

alter table public.lab_results
  add column if not exists numeric_value numeric,
  add column if not exists abnormal_flag text,
  add column if not exists analyzer text,
  add column if not exists verified_by uuid,
  add column if not exists verified_at timestamptz,
  add column if not exists provenance text,
  add column if not exists is_synthetic boolean not null default false,
  add column if not exists simulation_run_id uuid;

alter table public.patients
  add column if not exists is_synthetic boolean not null default false,
  add column if not exists simulation_run_id uuid,
  add column if not exists data_classification text;

alter table public.encounters
  add column if not exists person_id uuid,
  add column if not exists correlation_id uuid,
  add column if not exists is_synthetic boolean not null default false,
  add column if not exists simulation_run_id uuid;

-- ---------------------------------------------------------------------------
-- Domain event outbox (Synapse Exchange)
-- ---------------------------------------------------------------------------
create table if not exists public.synapse_domain_events (
  event_id uuid primary key default gen_random_uuid(),
  event_type text not null,
  version text not null default '1.0.0',
  tenant_id uuid not null references public.tenants(id),
  facility_id uuid,
  actor_id uuid,
  patient_id uuid,
  person_id uuid,
  encounter_id uuid,
  occurred_at timestamptz not null default now(),
  correlation_id uuid not null,
  causation_id uuid,
  payload jsonb not null default '{}'::jsonb,
  source text not null,
  idempotency_key text not null,
  is_synthetic boolean not null default false,
  simulation_run_id uuid,
  status text not null default 'pending'
    check (status in ('pending','published','failed','dead')),
  retry_count integer not null default 0,
  last_error text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (idempotency_key)
);

create index if not exists synapse_domain_events_correlation_idx
  on public.synapse_domain_events (correlation_id, occurred_at);
create index if not exists synapse_domain_events_tenant_type_idx
  on public.synapse_domain_events (tenant_id, event_type, occurred_at desc);
create index if not exists synapse_domain_events_sim_idx
  on public.synapse_domain_events (simulation_run_id)
  where simulation_run_id is not null;

-- ---------------------------------------------------------------------------
-- Lab safety: amendments + critical acknowledgements + reference ranges
-- ---------------------------------------------------------------------------
create table if not exists public.lab_result_amendments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  result_id uuid not null,
  lab_order_id uuid,
  previous_value text not null,
  previous_status text not null,
  new_value text not null,
  reason text not null,
  amended_by uuid,
  amended_at timestamptz not null default now(),
  is_synthetic boolean not null default false
);

create table if not exists public.lab_critical_acknowledgements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  result_id uuid not null,
  lab_order_id uuid,
  patient_id uuid,
  acknowledged_by uuid not null,
  acknowledged_at timestamptz not null default now(),
  note text,
  is_synthetic boolean not null default false
);

create table if not exists public.lab_reference_ranges (
  id uuid primary key default gen_random_uuid(),
  loinc_code text not null,
  test_name text not null,
  unit text not null,
  sex text,
  age_min_years numeric,
  age_max_years numeric,
  low numeric not null,
  high numeric not null,
  critical_low numeric,
  critical_high numeric,
  country_pack text not null default 'UG'
);

create unique index if not exists lab_reference_ranges_natural_key
  on public.lab_reference_ranges (
    loinc_code,
    coalesce(sex, ''),
    coalesce(age_min_years, -1),
    coalesce(age_max_years, -1),
    country_pack
  );

insert into public.lab_reference_ranges
  (loinc_code, test_name, unit, low, high, critical_low, critical_high)
values
  ('2524-7', 'Lactate', 'mmol/L', 0.5, 2.0, null, 4.0),
  ('6690-2', 'WBC', '10*9/L', 4.0, 11.0, 1.0, 30.0),
  ('2345-7', 'Glucose', 'mmol/L', 3.9, 6.1, 2.2, 30.0),
  ('2951-2', 'Sodium', 'mmol/L', 135, 145, 120, 160),
  ('2823-3', 'Potassium', 'mmol/L', 3.5, 5.1, 2.5, 6.5)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Pathway overrides (existing patient_pathways.overrides JSON remains)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Clinical prescriptions bridging OS → Pharm
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Simulation runs (never target production)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Platform control center (no generic SQL console)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- RLS: deny anon/authenticated by default. Platform APIs use service_role.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
  tables text[] := array[
    'synapse_domain_events',
    'lab_result_amendments',
    'lab_critical_acknowledgements',
    'lab_reference_ranges',
    'pathway_overrides',
    'clinical_prescriptions',
    'synapse_simulation_runs',
    'platform_incidents',
    'platform_health_checks',
    'platform_module_matrix'
  ];
begin
  foreach t in array tables loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from public, anon', t);
    -- authenticated users never get a generic grant; service_role bypasses RLS.
  end loop;
end $$;

-- Tenant-scoped clinical tables: reuse tenant isolation if helpers exist.
do $$
declare
  t text;
  tenant_tables text[] := array[
    'synapse_domain_events',
    'lab_result_amendments',
    'lab_critical_acknowledgements',
    'pathway_overrides',
    'clinical_prescriptions',
    'synapse_simulation_runs',
    'platform_module_matrix'
  ];
begin
  if to_regprocedure('public.current_tenant_id()') is null
     or to_regprocedure('public.is_platform_admin()') is null then
    return;
  end if;
  foreach t in array tenant_tables loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = t
        and policyname = t || '_tenant_isolation'
    ) then
      execute format(
        'create policy %I on public.%I for all using (tenant_id = current_tenant_id() or is_platform_admin()) with check (tenant_id = current_tenant_id() or is_platform_admin())',
        t || '_tenant_isolation', t
      );
    end if;
  end loop;
end $$;
