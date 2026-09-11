-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260817164946  name: synapse_network_identity_foundations_links_scope
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.

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
