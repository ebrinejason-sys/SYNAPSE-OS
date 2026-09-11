-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260828174832  name: platform_control_plane_core
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.

alter table public.hospitals
  add column if not exists is_synthetic boolean not null default false,
  add column if not exists environment text not null default 'production',
  add column if not exists lifecycle_status text not null default 'active',
  add column if not exists protected_from_billing boolean not null default false,
  add column if not exists protected_from_external_reporting boolean not null default false;

alter table public.hospitals drop constraint if exists hospitals_environment_check;
alter table public.hospitals
  add constraint hospitals_environment_check
  check (environment in ('production', 'staging', 'demo', 'development'));

alter table public.hospitals drop constraint if exists hospitals_lifecycle_status_check;
alter table public.hospitals
  add constraint hospitals_lifecycle_status_check
  check (lifecycle_status in (
    'application', 'approved', 'onboarding', 'pilot', 'active', 'suspended', 'offboarded'
  ));

update public.hospitals
set
  protected_from_billing = true,
  protected_from_external_reporting = true,
  environment = 'demo'
where is_synthetic = true
  and (protected_from_billing = false or protected_from_external_reporting = false);

alter table public.profiles
  add column if not exists platform_control_role text;

alter table public.profiles drop constraint if exists profiles_platform_control_role_check;
alter table public.profiles
  add constraint profiles_platform_control_role_check
  check (
    platform_control_role is null
    or platform_control_role in (
      'super_admin',
      'platform_admin',
      'security_admin',
      'integration_admin',
      'release_manager',
      'billing_admin',
      'customer_success',
      'support_admin',
      'clinical_governance',
      'read_only_auditor'
    )
  );

create or replace function public.is_platform_operator()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.hospital_id is null
      and (
        p.role in ('superadmin', 'super_admin', 'platform_admin', 'overall_admin')
        or p.platform_control_role in (
          'super_admin', 'platform_admin', 'security_admin', 'integration_admin',
          'release_manager', 'billing_admin', 'customer_success', 'support_admin',
          'clinical_governance', 'read_only_auditor'
        )
      )
  );
$$;
