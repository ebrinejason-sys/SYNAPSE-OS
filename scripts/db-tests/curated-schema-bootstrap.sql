-- Curated minimal schema for isolated, disposable Postgres facility-invitation
-- acceptance testing. NOT a supabase migration — this file exists only to
-- bootstrap scripts/facility-invitation-db-tests.sh against a throwaway
-- Postgres container (see that script for how it's applied). It intentionally
-- includes only the tables/functions the facility-invitation feature touches;
-- the full historical migration chain in supabase/migrations could not be
-- replayed end-to-end in this environment (see the "Real database test
-- attempt" section of docs/engineering/FACILITY_INVITATION_HARDENING.md for
-- the precise failing migrations and missing-table dependencies discovered).
-- Prerequisite tables are reduced fixtures derived from the named sources.
-- They are NOT proof of parity with production DDL or its full constraint set.
-- The acceptance and MFA migrations at the bottom are loaded directly from
-- the repository, so RPC behavior is tested on PostgreSQL, not mocked.

create extension if not exists pgcrypto;

-- from 20260817120000_synapse_network_identity_foundations.sql context (tenants predates migrations)
create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  slug text unique,
  name text not null,
  facility_type text not null default 'hospital',
  plan text not null default 'trial',
  is_active boolean not null default true,
  is_synthetic boolean not null default false,
  environment text,
  data_classification text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- profiles predates migrations in this repo (see packages/auth/src/context.server.ts
-- for the full column list this bootstrap reproduces); custom-auth columns are
-- from 20260612000002_profiles_custom_auth_columns.sql.
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  full_name text,
  first_name text,
  last_name text,
  role text,
  tenant_id uuid references public.tenants(id),
  hospital_id uuid,
  department_id uuid,
  is_admin boolean not null default false,
  avatar_url text,
  synapse_id text,
  onboarding_complete boolean not null default false,
  verification_status text,
  email_verified_at timestamptz,
  must_change_password boolean not null default false,
  password_hash text,
  password_changed_at timestamptz,
  login_attempts integer not null default 0,
  locked_until timestamptz,
  last_sign_in_at timestamptz,
  is_deleted boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

-- from 20260612000003_rls_helper_functions.sql (verbatim)
create or replace function current_tenant_id()
returns uuid
language sql
security definer
stable
as $$
  select tenant_id from profiles where id = auth.uid() limit 1;
$$;

create or replace function is_platform_admin()
returns boolean
language sql
security definer
stable
as $$
  select exists(
    select 1 from profiles where id = auth.uid() and role = 'platform_admin'
  );
$$;

-- from 20260613000003_lock_down_auth_rls_helpers_anon_execute.sql (same intent)
revoke all on function current_tenant_id() from anon;
revoke all on function is_platform_admin() from anon;
grant execute on function current_tenant_id() to authenticated, service_role;
grant execute on function is_platform_admin() to authenticated, service_role;

-- from 20260817120000_synapse_network_identity_foundations.sql (verbatim)
create table if not exists public.staff_scope_assignments (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null,
  organization_id uuid,
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

alter table public.staff_scope_assignments enable row level security;

create policy staff_scope_assignments_self_or_admin on public.staff_scope_assignments
  for all
  using (
    is_platform_admin()
    or profile_id = auth.uid()
    or tenant_id = current_tenant_id()
  )
  with check (
    is_platform_admin()
    or profile_id = auth.uid()
    or tenant_id = current_tenant_id()
  );

-- from 20260609_missing_operational_tables.sql (mfa_enrollments only; the rest
-- of that file is unrelated pharmacy schema not reproduced here)
create table if not exists public.mfa_enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  secret text not null,
  verified boolean default false,
  backup_codes text[],
  created_at timestamptz default now(),
  last_used_at timestamptz
);
alter table public.mfa_enrollments enable row level security;
create index if not exists idx_mfa_enrollments_user_id on public.mfa_enrollments(user_id);
create policy mfa_own_all on public.mfa_enrollments
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- from 20260612000001_synapse_sessions.sql (verbatim)
create table if not exists synapse_sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references profiles(id) on delete cascade,
  token_hash   text not null unique,
  app          text not null check (app in ('web', 'pharmacy', 'mobile', 'api')),
  ip_address   text,
  user_agent   text,
  expires_at   timestamptz not null,
  revoked_at   timestamptz,
  last_used_at timestamptz default now(),
  created_at   timestamptz default now()
);
alter table synapse_sessions enable row level security;
create policy users_own_sessions_select on synapse_sessions
  for select using (user_id = auth.uid());

-- from 20260902120000_facility_provisioning_runs.sql (facility_invitations only)
create table if not exists public.facility_invitations (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants(id) on delete cascade,
  run_id           uuid,
  email            text not null,
  full_name        text,
  role             text not null default 'hospital_admin',
  invite_token     text unique,
  status           text not null default 'PENDING'
                   check (status in (
                     'PENDING', 'SENT', 'ACCEPTED', 'EXPIRED', 'FAILED', 'REVOKED'
                   )),
  expires_at       timestamptz not null,
  sent_at          timestamptz,
  accepted_at      timestamptz,
  revoked_at       timestamptz,
  last_error       text,
  profile_id       uuid,
  created_by       uuid,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists idx_facility_invitations_tenant on public.facility_invitations (tenant_id, status);

-- from supabase/migrations/20260910120000_facility_invitations_token_hash.sql (verbatim)
alter table public.facility_invitations alter column invite_token drop not null;
alter table public.facility_invitations add column if not exists token_hash text;
alter table public.facility_invitations add column if not exists redeemed_by uuid references public.profiles(id) on delete set null;
alter table public.facility_invitations add constraint facility_invitations_token_xor_hash check (num_nonnulls(invite_token, token_hash) = 1);
create unique index if not exists facility_invitations_token_hash_uidx on public.facility_invitations (token_hash) where token_hash is not null;

\ir ../../supabase/migrations/20260910130000_facility_invitations_acceptance_tx.sql
\ir ../../supabase/migrations/20260911100000_session_bound_mfa_assurance.sql
