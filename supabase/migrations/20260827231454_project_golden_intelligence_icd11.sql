-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260827231454  name: project_golden_intelligence_icd11
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.

create table if not exists public.reasoning_sessions (
  id uuid primary key default gen_random_uuid(),
  encounter_id uuid,
  tenant_id uuid not null references public.tenants(id),
  created_by uuid,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.icd11_cache (
  stem_code text primary key,
  title text not null,
  foundation_uri text not null,
  linearization_uri text not null,
  classification text not null default 'ICD-11 MMS',
  release text not null default '2026-01',
  extension_codes text[] not null default '{}',
  source text not null default 'seed',
  updated_at timestamptz not null default now()
);

insert into public.icd11_cache (stem_code, title, foundation_uri, linearization_uri, source)
values
  ('1G40', 'Sepsis without septic shock', 'https://id.who.int/icd/entity/1435254666', 'https://id.who.int/icd/release/11/2026-01/mms/1G40', 'seed'),
  ('1F40', 'Malaria due to Plasmodium falciparum', 'https://id.who.int/icd/entity/585833267', 'https://id.who.int/icd/release/11/2026-01/mms/1F40', 'seed'),
  ('CA40', 'Pneumonia', 'https://id.who.int/icd/entity/1420522198', 'https://id.who.int/icd/release/11/2026-01/mms/CA40', 'seed'),
  ('5A21', 'Diabetic ketoacidosis', 'https://id.who.int/icd/entity/129607455', 'https://id.who.int/icd/release/11/2026-01/mms/5A21', 'seed')
on conflict (stem_code) do nothing;

create table if not exists public.intelligence_recommendations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  encounter_id uuid,
  patient_id uuid,
  clinician_id uuid,
  task text not null,
  recommendation text not null,
  reasoning_summary text,
  proposed_terms text[] not null default '{}',
  suggested_pathway_id text,
  confidence numeric,
  cannot_miss boolean not null default false,
  provenance jsonb not null default '{}'::jsonb,
  model text,
  prompt_version text,
  created_at timestamptz not null default now()
);

create table if not exists public.intelligence_actions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  recommendation_id uuid references public.intelligence_recommendations(id),
  clinician_id uuid not null,
  decision text not null check (decision in ('ACCEPT','MODIFY','REJECT','DEFER')),
  reason text,
  modified_text text,
  created_at timestamptz not null default now()
);

create table if not exists public.synapse_adapters (
  id text primary key,
  name text not null,
  system text not null,
  mode text not null check (mode in ('native','overlay','network')),
  simulation boolean not null default true,
  version text not null,
  status text not null default 'simulation',
  last_success_at timestamptz,
  last_failure_at timestamptz,
  messages_today integer not null default 0,
  failed_today integer not null default 0,
  updated_at timestamptz not null default now()
);

do $$
declare
  t text;
  tables text[] := array[
    'icd11_cache',
    'intelligence_recommendations',
    'intelligence_actions',
    'synapse_adapters'
  ];
begin
  foreach t in array tables loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from public, anon', t);
  end loop;
end $$;
