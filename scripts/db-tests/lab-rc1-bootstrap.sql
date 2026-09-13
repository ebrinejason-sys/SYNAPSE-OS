-- Lab RC1 disposable bootstrap.
-- NOT a supabase migration. Sources are named repository migrations / curated fixtures.
-- Purpose: apply real lab DDL prerequisites so 20260913010000_lab_order_replacement_link.sql
-- can be proven on a throwaway Postgres. Does not claim full production schema parity.

create extension if not exists pgcrypto;

-- tenants/profiles applied separately from curated-schema-bootstrap.sql

-- patients/encounters minimal (required by lab_orders FKs in 20260716110812_backfill_missing_baseline_tables.sql)
create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  first_name text,
  last_name text,
  mrn text,
  is_synthetic boolean not null default false,
  data_classification text,
  created_at timestamptz not null default now()
);

create table if not exists public.encounters (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  patient_id uuid not null references public.patients(id),
  status text default 'in_progress',
  is_signed boolean not null default false,
  chief_complaint text,
  metadata jsonb default '{}'::jsonb,
  disposition text,
  disposition_reason text,
  disposition_by uuid,
  disposition_at timestamptz,
  is_synthetic boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- from 20260716110812_backfill_missing_baseline_tables.sql (lab_orders core)
CREATE TABLE IF NOT EXISTS public.lab_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  encounter_id UUID NOT NULL REFERENCES public.encounters(id),
  patient_id UUID NOT NULL REFERENCES public.patients(id),
  loinc_code TEXT,
  test_name TEXT NOT NULL,
  urgency TEXT NOT NULL DEFAULT 'ROUTINE' CHECK (urgency IN ('STAT','URGENT','ROUTINE')),
  status TEXT NOT NULL DEFAULT 'ordered',
  ordered_by UUID NOT NULL REFERENCES public.profiles(id),
  ordered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  collected_at TIMESTAMPTZ,
  resulted_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES public.profiles(id),
  insurance_covered BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- from 20260827231349_synapse_exchange_lab_pathways_simulation.sql
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

-- lab_results minimal for reports FK (exists in production; columns from exchange + lims migrations)
create table if not exists public.lab_results (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  lab_order_id uuid not null references public.lab_orders(id) on delete cascade,
  patient_id uuid not null references public.patients(id),
  loinc_code text,
  test_name text,
  result_value text,
  numeric_value numeric,
  unit text,
  reference_range text,
  abnormal_flag text,
  is_critical boolean default false,
  is_abnormal boolean default false,
  status text not null default 'preliminary',
  analyzer text,
  verified_by uuid,
  verified_at timestamptz,
  released_at timestamptz,
  version integer not null default 1,
  provenance text,
  is_synthetic boolean not null default false,
  created_at timestamptz not null default now()
);

-- from 20260817120000_synapse_network_identity_foundations.sql (lab_specimens + outbox)
create table if not exists public.lab_specimens (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  person_id uuid,
  patient_id uuid references public.patients(id),
  encounter_id uuid,
  lab_order_id uuid,
  accession_number text not null,
  barcode text,
  specimen_type text,
  status text not null default 'collected',
  rejection_reason text,
  rejection_note text,
  collected_at timestamptz,
  received_at timestamptz,
  collected_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.offline_mutation_outbox (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  site_id uuid,
  actor_id uuid references public.profiles(id),
  mutation_type text not null,
  idempotency_key text not null,
  payload jsonb not null,
  status text not null default 'queued'
    check (status in ('queued','syncing','applied','conflict','rejected')),
  client_device_id text,
  created_at timestamptz not null default now(),
  applied_at timestamptz,
  conflict_reason text,
  unique (tenant_id, idempotency_key)
);

-- from 20260908120000_lab_reports_release_artifacts.sql (verbatim structure)
CREATE TABLE IF NOT EXISTS public.lab_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  facility_id UUID,
  patient_id UUID NOT NULL,
  encounter_id UUID,
  lab_order_id UUID NOT NULL,
  clinical_result_id UUID NOT NULL REFERENCES public.lab_results(id),
  accession TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('FINAL', 'AMENDED')),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  report_type TEXT NOT NULL DEFAULT 'LAB_RESULT',
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  generated_by UUID,
  verified_by UUID,
  released_at TIMESTAMPTZ NOT NULL,
  supersedes_report_id UUID REFERENCES public.lab_reports(id),
  amendment_reason TEXT,
  template_version TEXT NOT NULL DEFAULT 'lab-report.v1',
  html_snapshot TEXT NOT NULL,
  artifact_path TEXT,
  content_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, lab_order_id, version)
);

-- hospital_modules for gateHospitalModule (minimal)
create table if not exists public.hospital_modules (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null,
  module_key text not null,
  is_active boolean not null default true,
  unique (hospital_id, module_key)
);

-- has_capability stub from lattice intent: allow seeded roles for disposable lab acceptance only.
-- Source function shape: 20260613072631_has_capability_function.sql / tensor lattice.
create table if not exists public.role_capabilities (
  id uuid primary key default gen_random_uuid(),
  role text not null,
  facility_type text not null default 'hospital',
  module text not null,
  resource text not null,
  action text not null,
  unique (role, facility_type, module, resource, action)
);

create or replace function public.has_capability(
  p_role text,
  p_facility_type text,
  p_module text,
  p_resource text,
  p_action text
) returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.role_capabilities rc
    where rc.role = p_role
      and rc.facility_type = p_facility_type
      and rc.module = p_module
      and rc.resource = p_resource
      and rc.action = p_action
  );
$$;
grant execute on function public.has_capability(text,text,text,text,text) to anon, authenticated, service_role;

-- Added 2026-09-13 during disposable HTTP acceptance (columns referenced by app persist paths)
alter table public.lab_results add column if not exists entered_by uuid references public.profiles(id);
alter table public.lab_results add column if not exists entered_at timestamptz;
alter table public.lab_results add column if not exists amended_by uuid references public.profiles(id);
alter table public.lab_results add column if not exists amended_at timestamptz;
alter table public.lab_results add column if not exists amend_reason text;
alter table public.lab_results add column if not exists result_source text;
alter table public.lab_results add column if not exists released_to_patient_at timestamptz;
alter table public.encounters add column if not exists clinical_stage text;
alter table public.encounters add column if not exists clinical_note text;
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  user_id uuid,
  user_role text,
  action text,
  table_name text,
  record_id text,
  old_value jsonb,
  new_value jsonb,
  created_by uuid,
  created_at timestamptz not null default now()
);

alter table public.tenants add column if not exists status text not null default 'active';

