-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260828164925  name: clinical_intelligence_sessions
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.

create table if not exists public.clinical_intelligence_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.hospitals (id) on delete restrict,
  facility_id uuid not null references public.hospitals (id) on delete restrict,
  patient_id uuid references public.patients (id) on delete restrict,
  encounter_id uuid not null references public.encounters (id) on delete restrict,
  actor_id uuid references public.profiles (id) on delete set null,
  model text not null,
  model_version text not null,
  prompt_version text not null,
  context_snapshot jsonb not null default '{}'::jsonb,
  response jsonb not null default '{}'::jsonb,
  missing_information jsonb not null default '[]'::jsonb,
  red_flags jsonb not null default '[]'::jsonb,
  suggested_pathway_slug text,
  correlation_id text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_clinical_intelligence_sessions_encounter
  on public.clinical_intelligence_sessions (encounter_id, created_at desc);

create table if not exists public.clinical_intelligence_decisions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.clinical_intelligence_sessions (id) on delete cascade,
  tenant_id uuid not null references public.hospitals (id) on delete restrict,
  encounter_id uuid not null references public.encounters (id) on delete restrict,
  actor_id uuid not null references public.profiles (id) on delete restrict,
  recommendation_index integer not null default 0,
  decision text not null check (decision in ('ACCEPT', 'MODIFY', 'REJECT', 'DEFER')),
  reason text,
  modified_display text,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.encounter_diagnoses
  add column if not exists icd_release text,
  add column if not exists linearization_uri text,
  add column if not exists selected_by uuid references public.profiles (id) on delete set null,
  add column if not exists suggested_by text,
  add column if not exists intelligence_session_id uuid references public.clinical_intelligence_sessions (id) on delete set null;

alter table public.clinical_intelligence_sessions enable row level security;
alter table public.clinical_intelligence_decisions enable row level security;

comment on table public.clinical_intelligence_sessions is
  'Advisory intelligence snapshots. Never used as confirmed diagnoses.';
