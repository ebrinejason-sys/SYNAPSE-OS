-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260817164902  name: synapse_network_identity_foundations_mpi_consent
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.

create table if not exists public.identity_match_candidates (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.persons(id),
  candidate_person_id uuid not null references public.persons(id),
  confidence numeric(5,2) not null check (confidence >= 0 and confidence <= 100),
  match_signals jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending','confirmed_same','confirmed_distinct','merged','dismissed')),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint identity_match_not_self check (person_id <> candidate_person_id)
);

create index if not exists identity_match_pending_idx
  on public.identity_match_candidates (status, confidence desc)
  where status = 'pending';

create table if not exists public.identity_merge_events (
  id uuid primary key default gen_random_uuid(),
  surviving_person_id uuid not null references public.persons(id),
  retired_person_id uuid not null references public.persons(id),
  actor_id uuid references public.profiles(id),
  reason text,
  confidence numeric(5,2),
  identifiers_retained jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.identity_merge_events is
  'Merge audit. Identifiers of the retired person are retained (status=merged), never discarded.';

create table if not exists public.person_consents (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.persons(id) on delete cascade,
  purpose text not null
    check (purpose in (
      'facility_access','cross_facility_share','research','emergency_profile',
      'blood_donor_contact','dependant_access','insurance_exchange','care_delivery'
    )),
  scope_organization_id uuid references public.organizations(id),
  scope_facility_id uuid references public.tenants(id),
  status text not null default 'granted'
    check (status in ('granted','denied','withdrawn','expired')),
  granted_at timestamptz,
  expires_at timestamptz,
  withdrawn_at timestamptz,
  collected_by uuid references public.profiles(id),
  language text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists person_consents_person_purpose_idx
  on public.person_consents (person_id, purpose, status);

create table if not exists public.person_consent_events (
  id uuid primary key default gen_random_uuid(),
  consent_id uuid not null references public.person_consents(id) on delete cascade,
  actor_id uuid references public.profiles(id),
  action text not null,
  from_status text,
  to_status text,
  created_at timestamptz not null default now()
);

create table if not exists public.insurance_memberships (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.persons(id) on delete cascade,
  payer_id uuid references public.insurance_providers(id),
  payer_name text not null,
  member_number text not null,
  policy_number text,
  scheme text,
  employer text,
  beneficiary_type text default 'primary'
    check (beneficiary_type in ('primary','dependant','spouse','child','other')),
  effective_date date,
  expiry_date date,
  status text not null default 'active'
    check (status in ('active','expired','suspended','cancelled')),
  issuing_facility_id uuid references public.tenants(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists insurance_memberships_payer_member_uidx
  on public.insurance_memberships (
    coalesce(payer_id, '00000000-0000-0000-0000-000000000000'::uuid),
    lower(member_number)
  )
  where status = 'active';

create index if not exists insurance_memberships_person_idx on public.insurance_memberships (person_id);

create table if not exists public.blood_donation_profiles (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null unique references public.persons(id) on delete cascade,
  donor_number text,
  blood_group_fact_id uuid references public.person_clinical_facts(id),
  contact_consent boolean not null default false,
  next_eligible_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.blood_donations (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.persons(id),
  facility_id uuid references public.tenants(id),
  donated_on date not null,
  donation_type text not null default 'whole_blood'
    check (donation_type in ('whole_blood','plasma','platelets','autologous','other')),
  units numeric(6,2) not null default 1,
  screening_status text not null default 'pending'
    check (screening_status in ('pending','cleared','deferred','reactive','unknown')),
  adverse_reaction text,
  created_at timestamptz not null default now()
);

create table if not exists public.blood_deferrals (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.persons(id),
  reason text not null,
  starts_on date not null default current_date,
  ends_on date,
  is_permanent boolean not null default false,
  created_at timestamptz not null default now()
);
