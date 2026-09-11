-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260817164837  name: synapse_network_identity_foundations_persons
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.

create table if not exists public.persons (
  id uuid primary key default gen_random_uuid(),
  synapse_id text not null unique,
  given_name text,
  family_name text,
  other_names text,
  full_name text not null,
  date_of_birth date,
  sex text check (sex is null or sex in ('M','F','I','U')),
  preferred_language text,
  district text,
  country_code text not null default 'UG',
  merged_into_person_id uuid references public.persons(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists persons_full_name_trgm_idx on public.persons using gin (full_name gin_trgm_ops);
create index if not exists persons_dob_idx on public.persons (date_of_birth);
create index if not exists persons_merged_idx on public.persons (merged_into_person_id)
  where merged_into_person_id is not null;

comment on table public.persons is
  'Platform-level person. UUID is the immutable identifier. synapse_id is the human-readable SYN-CC-XXXXXXXX label. A person is not owned by a hospital.';

create or replace function public.generate_synapse_id(p_country_code text)
returns text
language plpgsql
as $fn$
declare
  alphabet constant text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  raw bytea;
  n numeric;
  i int;
  body text;
  check_idx int;
  candidate text;
  cc text;
  attempts int := 0;
  taken boolean;
begin
  cc := upper(regexp_replace(coalesce(nullif(trim(p_country_code), ''), 'UG'), '[^A-Z]', '', 'g'));
  if length(cc) <> 2 then
    cc := 'UG';
  end if;

  loop
    attempts := attempts + 1;
    raw := gen_random_bytes(5);
    n := 0;
    for i in 0..4 loop
      n := n * 256 + get_byte(raw, i);
    end loop;
    body := '';
    for i in 1..8 loop
      body := substr(alphabet, (n % 32)::int + 1, 1) || body;
      n := trunc(n / 32);
    end loop;
    check_idx := (
      ascii(substr(body, 1, 1)) + ascii(substr(body, 3, 1)) + ascii(substr(body, 5, 1))
      + ascii(substr(body, 8, 1)) + ascii(cc, 1) + ascii(cc, 2)
    ) % 32;
    candidate := 'SYN-' || cc || '-' || body || substr(alphabet, check_idx + 1, 1);
    taken := exists (select 1 from public.persons where synapse_id = candidate);
    if not taken and to_regclass('public.patient_profiles') is not null then
      execute 'select exists (select 1 from public.patient_profiles where synapse_id = $1)'
        into taken using candidate;
    end if;
    exit when not taken;
    if attempts > 8 then
      raise exception 'SYNAPSE_ID_GENERATION_FAILED';
    end if;
  end loop;
  return candidate;
end;
$fn$;

create or replace function public.persons_assign_synapse_id()
returns trigger
language plpgsql
as $fn$
begin
  if new.synapse_id is null or btrim(new.synapse_id) = '' then
    new.synapse_id := public.generate_synapse_id(new.country_code);
  end if;
  if new.full_name is null or btrim(new.full_name) = '' then
    new.full_name := btrim(concat_ws(' ', new.given_name, new.other_names, new.family_name));
  end if;
  new.updated_at := now();
  return new;
end;
$fn$;

drop trigger if exists persons_assign_synapse_id on public.persons;
create trigger persons_assign_synapse_id
before insert or update on public.persons
for each row execute function public.persons_assign_synapse_id();

create table if not exists public.person_identifiers (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.persons(id) on delete cascade,
  identifier_value text not null,
  identifier_type text not null
    check (identifier_type in (
      'SYNAPSE_ID','MRN','UHID','OPENMRS','UGANDAEMR','LAB_NUMBER',
      'INSURANCE_MEMBER','DONOR_NUMBER','NIN','PHONE','OTHER'
    )),
  issuing_organization_id uuid references public.organizations(id),
  issuing_facility_id uuid references public.tenants(id),
  source_system text,
  status text not null default 'active'
    check (status in ('active','superseded','revoked','merged')),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint person_identifiers_value_present check (length(btrim(identifier_value)) > 0)
);

create unique index if not exists person_identifiers_issuer_namespace_uidx
  on public.person_identifiers (
    coalesce(issuing_organization_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(issuing_facility_id, '00000000-0000-0000-0000-000000000000'::uuid),
    identifier_type,
    lower(identifier_value)
  )
  where status = 'active';

create index if not exists person_identifiers_person_idx on public.person_identifiers (person_id);
create index if not exists person_identifiers_value_idx on public.person_identifiers (lower(identifier_value));

comment on table public.person_identifiers is
  'Facility- and system-local identifiers mapped to one person UUID. Never treat identical strings from different issuers as the same namespace.';
