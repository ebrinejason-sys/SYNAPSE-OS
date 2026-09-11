-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260817164805  name: synapse_network_identity_foundations
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.

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

update public.tenants
set facility_mode = coalesce(facility_mode, 'NATIVE'),
    site_kind = coalesce(site_kind, 'main'),
    digital_maturity_level = coalesce(digital_maturity_level, 1)
where facility_mode is null or site_kind is null or digital_maturity_level is null;
