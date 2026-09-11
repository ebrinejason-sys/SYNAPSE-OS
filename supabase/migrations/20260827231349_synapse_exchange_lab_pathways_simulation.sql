-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260827231349  name: synapse_exchange_lab_pathways_simulation
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.

create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

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
