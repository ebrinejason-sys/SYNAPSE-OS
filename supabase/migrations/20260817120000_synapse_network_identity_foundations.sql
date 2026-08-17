-- =============================================================================
-- SYNAPSE network identity, facility hierarchy, scoped RBAC, provenance,
-- consent, emergency profile, blood donation, insurance memberships,
-- interoperability, laboratory specimen, offline outbox, and pharmacy sites.
--
-- ADDITIVE + REVERSIBLE. Does not recreate live pharmacy POS/inventory tables.
-- Does not destroy or rewrite patients / pharmacy_customers rows.
-- person_id columns are nullable so existing records keep working until linked.
-- Preserves live public.generate_synapse_id() (zero-arg) used by patient_profiles.
--
-- Rollback outline:
--   drop functions / policies created here; drop new tables; drop added columns.
-- =============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";
create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------------------------
-- 1. Organizations (parent of facilities / tenants)
-- ---------------------------------------------------------------------------
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  org_type text not null default 'hospital'
    check (org_type in (
      'hospital','pharmacy_chain','laboratory','blood_bank',
      'insurance','community','mixed'
    )),
  country_code text not null default 'UG',
  region text,
  district text,
  phone text,
  email text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists organizations_org_type_idx on public.organizations (org_type);

-- ---------------------------------------------------------------------------
-- 2. Extend tenants (facilities) — keep tenants as the facility primitive
-- ---------------------------------------------------------------------------
alter table public.tenants
  add column if not exists organization_id uuid references public.organizations(id),
  add column if not exists parent_tenant_id uuid references public.tenants(id),
  add column if not exists facility_mode text,
  add column if not exists digital_maturity_level integer,
  add column if not exists site_kind text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'tenants_facility_mode_check'
  ) then
    alter table public.tenants
      add constraint tenants_facility_mode_check
      check (facility_mode is null or facility_mode in (
        'NATIVE','CONNECTED','HYBRID','SATELLITE','COMMUNITY_ACCESS'
      ));
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'tenants_maturity_check'
  ) then
    alter table public.tenants
      add constraint tenants_maturity_check
      check (digital_maturity_level is null or (digital_maturity_level between 0 and 5));
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'tenants_site_kind_check'
  ) then
    alter table public.tenants
      add constraint tenants_site_kind_check
      check (site_kind is null or site_kind in (
        'main','satellite','warehouse','community_access','branch'
      ));
  end if;
end $$;

create index if not exists tenants_organization_id_idx on public.tenants (organization_id);
create index if not exists tenants_parent_tenant_id_idx on public.tenants (parent_tenant_id);

comment on column public.tenants.facility_mode is
  'NATIVE = SYNAPSE is primary EMR/HMS; CONNECTED = external HMS retained; HYBRID = mix; SATELLITE / COMMUNITY_ACCESS are scoped sites.';

-- Default existing tenants to native facilities of their own organization (lazy; no rewrite of names).
update public.tenants
set facility_mode = coalesce(facility_mode, 'NATIVE'),
    site_kind = coalesce(site_kind, 'main'),
    digital_maturity_level = coalesce(digital_maturity_level, 1)
where facility_mode is null or site_kind is null or digital_maturity_level is null;

-- ---------------------------------------------------------------------------
-- 3. Universal person identity
-- ---------------------------------------------------------------------------
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

-- Human-readable SYNAPSE ID: SYN-{ISO3166}-{8 Crockford}{1 check}
-- Collision-resistant: 40 bits of entropy from gen_random_bytes + uniqueness retry.
-- One-arg overload for persons. Intentionally no DEFAULT so it cannot collide
-- with the live zero-arg generate_synapse_id() used by patient_profiles.
create or replace function public.generate_synapse_id(p_country_code text)
returns text
language plpgsql
as $$
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
    raw := gen_random_bytes(5); -- 40 bits
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
$$;

create or replace function public.persons_assign_synapse_id()
returns trigger
language plpgsql
as $$
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
$$;

drop trigger if exists persons_assign_synapse_id on public.persons;
create trigger persons_assign_synapse_id
before insert or update on public.persons
for each row execute function public.persons_assign_synapse_id();

-- ---------------------------------------------------------------------------
-- 4. External patient identifiers (namespaced per issuer)
-- ---------------------------------------------------------------------------
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

-- Same string from different issuers is a different identifier.
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

-- ---------------------------------------------------------------------------
-- 5. Contacts, clinical facts with provenance, emergency, relationships
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 6. MPI / identity resolution (no automatic merge of uncertain matches)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 7. Consent (contextual — not a global boolean)
-- ---------------------------------------------------------------------------
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

-- Existing patient_consents (encounter/module scoped) remain. This table is person-level.

-- ---------------------------------------------------------------------------
-- 8. Insurance memberships (person-level; claims stay on existing tables)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 9. Blood donation domain (consent-gated; no unsafe matching)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 10. Link existing patient / customer rows without replacing them
-- ---------------------------------------------------------------------------
alter table public.patients
  add column if not exists person_id uuid references public.persons(id);

create index if not exists patients_person_id_idx on public.patients (person_id);

do $$
begin
  if to_regclass('public.pharmacy_customers') is not null then
    alter table public.pharmacy_customers
      add column if not exists person_id uuid references public.persons(id);
    create index if not exists pharmacy_customers_person_id_idx on public.pharmacy_customers (person_id);
  end if;
  if to_regclass('public.patient_timeline_events') is not null then
    alter table public.patient_timeline_events
      add column if not exists person_id uuid references public.persons(id),
      add column if not exists provenance text,
      add column if not exists site_id uuid;
    begin
      alter table public.patient_timeline_events alter column patient_id drop not null;
    exception when others then
      null;
    end;
  end if;
end $$;

do $$
begin
  if to_regclass('public.patient_timeline_events') is not null
     and not exists (
       select 1 from pg_constraint where conname = 'patient_timeline_events_provenance_check'
     ) then
    alter table public.patient_timeline_events
      add constraint patient_timeline_events_provenance_check
      check (provenance is null or provenance in (
        'SELF_REPORTED','PROVIDER_VERIFIED','LAB_VERIFIED','IMPORTED','SYSTEM_GENERATED'
      ));
  end if;
end $$;

do $$
begin
  if to_regclass('public.patient_timeline_events') is not null then
    execute 'create index if not exists patient_timeline_events_person_idx on public.patient_timeline_events (person_id, event_date desc)';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 11. Scoped RBAC assignments (role + scope)
-- ---------------------------------------------------------------------------
create table if not exists public.staff_scope_assignments (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null,
  organization_id uuid references public.organizations(id),
  tenant_id uuid references public.tenants(id),
  site_id uuid,
  department_id uuid references public.departments(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staff_scope_has_scope check (
    organization_id is not null
    or tenant_id is not null
    or site_id is not null
    or department_id is not null
  )
);

create index if not exists staff_scope_assignments_profile_idx
  on public.staff_scope_assignments (profile_id)
  where is_active;

create unique index if not exists staff_scope_assignments_unique_idx
  on public.staff_scope_assignments (
    profile_id,
    role,
    coalesce(organization_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(site_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(department_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  where is_active;

do $$
begin
  if to_regclass('public.pharmacy_stores') is not null
     and not exists (
       select 1 from pg_constraint where conname = 'staff_scope_assignments_site_id_fkey'
     ) then
    alter table public.staff_scope_assignments
      add constraint staff_scope_assignments_site_id_fkey
      foreign key (site_id) references public.pharmacy_stores(id);
  end if;
  if to_regclass('public.pharmacy_user_settings') is not null then
    alter table public.pharmacy_user_settings
      add column if not exists store_id uuid;
    if to_regclass('public.pharmacy_stores') is not null
       and not exists (
         select 1 from pg_constraint where conname = 'pharmacy_user_settings_store_id_fkey'
       ) then
      alter table public.pharmacy_user_settings
        add constraint pharmacy_user_settings_store_id_fkey
        foreign key (store_id) references public.pharmacy_stores(id);
    end if;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 12. Pharmacy site stock + transfers (satellites)
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.pharmacy_product_batches') is not null then
    alter table public.pharmacy_product_batches add column if not exists store_id uuid;
  end if;
  if to_regclass('public.pharmacy_pos_sales') is not null then
    alter table public.pharmacy_pos_sales add column if not exists store_id uuid;
  end if;
  if to_regclass('public.pharmacy_stores') is not null then
    alter table public.pharmacy_stores
      add column if not exists parent_store_id uuid,
      add column if not exists address text,
      add column if not exists district text,
      add column if not exists phone text,
      add column if not exists is_warehouse boolean default false;
  end if;
end $$;

do $$
begin
  if to_regclass('public.pharmacy_product_batches') is not null then
    execute 'create index if not exists pharmacy_product_batches_store_idx on public.pharmacy_product_batches (store_id)';
  end if;
end $$;

create table if not exists public.pharmacy_stock_transfers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  from_store_id uuid not null,
  to_store_id uuid not null,
  status text not null default 'draft'
    check (status in ('draft','in_transit','received','cancelled')),
  requested_by uuid references public.profiles(id),
  received_by uuid references public.profiles(id),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  received_at timestamptz,
  constraint pharmacy_stock_transfers_distinct_stores check (from_store_id <> to_store_id)
);

create table if not exists public.pharmacy_stock_transfer_items (
  id uuid primary key default gen_random_uuid(),
  transfer_id uuid not null references public.pharmacy_stock_transfers(id) on delete cascade,
  product_id uuid not null,
  from_batch_id uuid,
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now()
);

create index if not exists pharmacy_stock_transfers_tenant_idx
  on public.pharmacy_stock_transfers (tenant_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 13. Interoperability hub tables
-- ---------------------------------------------------------------------------
create table if not exists public.interop_connections (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  adapter_type text not null
    check (adapter_type in (
      'fhir','hl7v2','astm','openmrs','ugandaemr','lis','rest','webhook','other'
    )),
  display_name text not null,
  endpoint_url text,
  credential_ref text,
  mapping jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  last_success_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists interop_connections_tenant_idx on public.interop_connections (tenant_id);

create table if not exists public.interop_messages (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid references public.interop_connections(id),
  tenant_id uuid not null references public.tenants(id),
  direction text not null check (direction in ('inbound','outbound')),
  protocol text not null,
  message_type text,
  external_id text,
  payload jsonb,
  raw_payload text,
  validation_status text not null default 'received'
    check (validation_status in ('received','valid','invalid','transformed','applied','rejected')),
  person_id uuid references public.persons(id),
  idempotency_key text,
  created_at timestamptz not null default now()
);

create unique index if not exists interop_messages_idempotency_uidx
  on public.interop_messages (tenant_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists interop_messages_tenant_created_idx
  on public.interop_messages (tenant_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 14. Laboratory specimen foundation (analyzer talks sample IDs, not MRNs)
-- ---------------------------------------------------------------------------
create table if not exists public.lab_specimens (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  person_id uuid references public.persons(id),
  patient_id uuid references public.patients(id),
  encounter_id uuid,
  lab_order_id uuid,
  accession_number text not null,
  barcode text,
  specimen_type text,
  status text not null default 'collected'
    check (status in ('ordered','collected','in_lab','on_analyzer','resulted','verified','rejected','disposed')),
  collected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists lab_specimens_tenant_accession_uidx
  on public.lab_specimens (tenant_id, accession_number);

create index if not exists lab_specimens_barcode_idx on public.lab_specimens (barcode);

create table if not exists public.lab_analyzer_messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  analyzer_id text,
  protocol text not null default 'hl7'
    check (protocol in ('hl7','astm','tcp','serial','middleware','other')),
  accession_number text,
  raw_message text not null,
  parsed jsonb,
  direction text not null default 'inbound' check (direction in ('inbound','outbound')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 15. Offline / edge mutation outbox
-- ---------------------------------------------------------------------------
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

create index if not exists offline_mutation_outbox_status_idx
  on public.offline_mutation_outbox (tenant_id, status, created_at);

-- ---------------------------------------------------------------------------
-- 16. Platform audit events (append-friendly; complements existing audit_log)
-- ---------------------------------------------------------------------------
create table if not exists public.platform_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  actor_role text,
  action text not null,
  resource_type text not null,
  resource_id uuid,
  organization_id uuid,
  tenant_id uuid,
  site_id uuid,
  source text,
  device_id text,
  session_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists platform_audit_events_resource_idx
  on public.platform_audit_events (resource_type, resource_id, created_at desc);
create index if not exists platform_audit_events_tenant_idx
  on public.platform_audit_events (tenant_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 17. Visibility helpers + RLS
-- ---------------------------------------------------------------------------
create or replace function public.person_visible_to_tenant(p_person_id uuid, p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.person_identifiers i
    where i.person_id = p_person_id
      and i.issuing_facility_id = p_tenant_id
      and i.status = 'active'
  ) or exists (
    select 1 from public.patients p
    where p.person_id = p_person_id and p.tenant_id = p_tenant_id
  ) or exists (
    select 1 from public.pharmacy_customers c
    where c.person_id = p_person_id and c.tenant_id = p_tenant_id
  );
$$;

revoke all on function public.person_visible_to_tenant(uuid, uuid) from public, anon;
grant execute on function public.person_visible_to_tenant(uuid, uuid) to authenticated, service_role;

create or replace function public.current_staff_site_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(site_id) filter (where site_id is not null), '{}'::uuid[])
  from public.staff_scope_assignments
  where profile_id = auth.uid() and is_active;
$$;

-- Enable RLS on new tables. Service role bypasses RLS (existing pharmacy pattern).
do $$
declare
  t text;
  tbls text[] := array[
    'organizations','persons','person_identifiers','person_contacts','person_clinical_facts',
    'person_relationships','emergency_profiles','emergency_access_events',
    'identity_match_candidates','identity_merge_events','person_consents','person_consent_events',
    'insurance_memberships','blood_donation_profiles','blood_donations','blood_deferrals',
    'staff_scope_assignments','pharmacy_stock_transfers','pharmacy_stock_transfer_items',
    'interop_connections','interop_messages','lab_specimens','lab_analyzer_messages',
    'offline_mutation_outbox','platform_audit_events'
  ];
begin
  foreach t in array tbls loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Tenant-scoped tables
do $$
declare
  t text;
  tenant_tbls text[] := array[
    'interop_connections','interop_messages','lab_specimens','lab_analyzer_messages',
    'offline_mutation_outbox','pharmacy_stock_transfers','platform_audit_events'
  ];
begin
  foreach t in array tenant_tbls loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;
    if not exists (
      select 1 from pg_policies where schemaname = 'public' and tablename = t
        and policyname = t || '_tenant_isolation'
    ) then
      execute format(
        'create policy %I on public.%I for all using (tenant_id = current_tenant_id() or is_platform_admin()) with check (tenant_id = current_tenant_id() or is_platform_admin())',
        t || '_tenant_isolation', t
      );
    end if;
  end loop;
end $$;

drop policy if exists staff_scope_assignments_self_or_admin on public.staff_scope_assignments;
create policy staff_scope_assignments_self_or_admin on public.staff_scope_assignments
  for all
  using (
    is_platform_admin()
    or profile_id = auth.uid()
    or tenant_id = current_tenant_id()
  )
  with check (
    is_platform_admin()
    or tenant_id = current_tenant_id()
  );

drop policy if exists persons_visible on public.persons;
create policy persons_visible on public.persons
  for select
  using (
    is_platform_admin()
    or public.person_visible_to_tenant(id, current_tenant_id())
  );

drop policy if exists persons_write_tenant on public.persons;
create policy persons_write_tenant on public.persons
  for insert
  with check (is_platform_admin() or current_tenant_id() is not null);

drop policy if exists persons_update_visible on public.persons;
create policy persons_update_visible on public.persons
  for update
  using (
    is_platform_admin()
    or public.person_visible_to_tenant(id, current_tenant_id())
  );

drop policy if exists person_identifiers_visible on public.person_identifiers;
create policy person_identifiers_visible on public.person_identifiers
  for all
  using (
    is_platform_admin()
    or issuing_facility_id = current_tenant_id()
    or public.person_visible_to_tenant(person_id, current_tenant_id())
  )
  with check (
    is_platform_admin()
    or issuing_facility_id = current_tenant_id()
    or issuing_facility_id is null
  );

drop policy if exists person_clinical_facts_visible on public.person_clinical_facts;
create policy person_clinical_facts_visible on public.person_clinical_facts
  for all
  using (
    is_platform_admin()
    or public.person_visible_to_tenant(person_id, current_tenant_id())
  )
  with check (
    is_platform_admin()
    or public.person_visible_to_tenant(person_id, current_tenant_id())
    or source_facility_id = current_tenant_id()
  );

drop policy if exists person_contacts_visible on public.person_contacts;
create policy person_contacts_visible on public.person_contacts
  for all
  using (
    is_platform_admin()
    or public.person_visible_to_tenant(person_id, current_tenant_id())
  )
  with check (
    is_platform_admin()
    or public.person_visible_to_tenant(person_id, current_tenant_id())
  );

drop policy if exists person_consents_visible on public.person_consents;
create policy person_consents_visible on public.person_consents
  for all
  using (
    is_platform_admin()
    or public.person_visible_to_tenant(person_id, current_tenant_id())
  )
  with check (
    is_platform_admin()
    or public.person_visible_to_tenant(person_id, current_tenant_id())
  );

drop policy if exists insurance_memberships_visible on public.insurance_memberships;
create policy insurance_memberships_visible on public.insurance_memberships
  for all
  using (
    is_platform_admin()
    or public.person_visible_to_tenant(person_id, current_tenant_id())
  )
  with check (
    is_platform_admin()
    or public.person_visible_to_tenant(person_id, current_tenant_id())
  );

drop policy if exists emergency_profiles_visible on public.emergency_profiles;
create policy emergency_profiles_visible on public.emergency_profiles
  for select
  using (
    is_platform_admin()
    or public.person_visible_to_tenant(person_id, current_tenant_id())
  );

drop policy if exists organizations_member_read on public.organizations;
create policy organizations_member_read on public.organizations
  for select
  using (
    is_platform_admin()
    or exists (
      select 1 from public.tenants t
      where t.organization_id = organizations.id
        and t.id = current_tenant_id()
    )
  );

-- Transfer items inherit via parent transfer tenant (service-role writes in app).
drop policy if exists pharmacy_stock_transfer_items_via_parent on public.pharmacy_stock_transfer_items;
create policy pharmacy_stock_transfer_items_via_parent on public.pharmacy_stock_transfer_items
  for all
  using (
    is_platform_admin()
    or exists (
      select 1 from public.pharmacy_stock_transfers tr
      where tr.id = transfer_id and tr.tenant_id = current_tenant_id()
    )
  )
  with check (
    is_platform_admin()
    or exists (
      select 1 from public.pharmacy_stock_transfers tr
      where tr.id = transfer_id and tr.tenant_id = current_tenant_id()
    )
  );

-- Person SYNAPSE IDs use generate_synapse_id(text).
-- Do NOT replace or revoke the existing zero-arg generate_synapse_id() used by
-- patient_profiles (granted to anon + authenticated on live SYNAPSE_OS).
revoke all on function public.generate_synapse_id(text) from public, anon;
grant execute on function public.generate_synapse_id(text) to authenticated, service_role;
