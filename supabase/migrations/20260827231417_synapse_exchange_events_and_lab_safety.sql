-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260827231417  name: synapse_exchange_events_and_lab_safety
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.

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
