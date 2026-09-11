-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260817164848  name: synapse_network_identity_foundations_profile
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.

create table if not exists public.person_contacts (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.persons(id) on delete cascade,
  contact_type text not null check (contact_type in ('phone','email','emergency','next_of_kin')),
  value text not null,
  label text,
  provenance text not null default 'SELF_REPORTED'
    check (provenance in ('SELF_REPORTED','PROVIDER_VERIFIED','LAB_VERIFIED','IMPORTED','SYSTEM_GENERATED')),
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists person_contacts_person_idx on public.person_contacts (person_id);

create table if not exists public.person_clinical_facts (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.persons(id) on delete cascade,
  fact_type text not null
    check (fact_type in (
      'blood_group','rhesus','allergy','chronic_condition','surgery',
      'current_medication','diagnosis','disability','pregnancy','preferred_language'
    )),
  value text not null,
  code text,
  code_system text,
  provenance text not null default 'SELF_REPORTED'
    check (provenance in ('SELF_REPORTED','PROVIDER_VERIFIED','LAB_VERIFIED','IMPORTED','SYSTEM_GENERATED')),
  verification_status text not null default 'UNVERIFIED'
    check (verification_status in ('UNVERIFIED','VERIFIED','DISPUTED','SUPERSEDED')),
  verified_by uuid references public.profiles(id),
  verified_at timestamptz,
  source_facility_id uuid references public.tenants(id),
  source_system text,
  notes text,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  superseded_by uuid references public.person_clinical_facts(id)
);

create index if not exists person_clinical_facts_person_type_idx
  on public.person_clinical_facts (person_id, fact_type)
  where verification_status <> 'SUPERSEDED';

comment on table public.person_clinical_facts is
  'Minimised clinical profile facts. Self-reported blood group must never appear as clinically verified.';

create table if not exists public.person_relationships (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.persons(id) on delete cascade,
  related_person_id uuid not null references public.persons(id) on delete cascade,
  relationship_type text not null
    check (relationship_type in (
      'parent','guardian','child','dependant','spouse','sibling','caregiver','other'
    )),
  can_manage boolean not null default false,
  status text not null default 'active' check (status in ('active','ended','revoked')),
  created_at timestamptz not null default now(),
  ended_at timestamptz,
  constraint person_relationships_not_self check (person_id <> related_person_id)
);

create unique index if not exists person_relationships_pair_uidx
  on public.person_relationships (person_id, related_person_id, relationship_type)
  where status = 'active';

create table if not exists public.emergency_profiles (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null unique references public.persons(id) on delete cascade,
  show_name boolean not null default true,
  show_blood_group boolean not null default false,
  show_allergies boolean not null default false,
  show_conditions boolean not null default false,
  show_medications boolean not null default false,
  show_emergency_contact boolean not null default true,
  access_token_hash text,
  token_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.emergency_access_events (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.persons(id),
  actor_id uuid references public.profiles(id),
  actor_role text,
  facility_id uuid references public.tenants(id),
  access_method text not null default 'break_glass'
    check (access_method in ('break_glass','qr_token','operator_assisted')),
  fields_disclosed text[] not null default '{}',
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists emergency_access_events_person_idx
  on public.emergency_access_events (person_id, created_at desc);
