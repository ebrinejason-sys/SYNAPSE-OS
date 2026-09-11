-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260828175226  name: platform_control_plane_ops_tables
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.

create table if not exists public.platform_approvals (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  risk_level text not null check (risk_level in ('high', 'critical')),
  target_type text not null,
  target_id text,
  payload jsonb not null default '{}'::jsonb,
  reason text not null,
  requested_by uuid not null references public.profiles (id) on delete restrict,
  requested_at timestamptz not null default timezone('utc', now()),
  status text not null default 'requested'
    check (status in ('requested', 'approved', 'rejected', 'executed', 'failed')),
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  review_reason text,
  executed_at timestamptz,
  execution_error text,
  correlation_id text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
create index if not exists idx_platform_approvals_status on public.platform_approvals (status, requested_at desc);
alter table public.platform_approvals enable row level security;
drop policy if exists platform_approvals_service_all on public.platform_approvals;
create policy platform_approvals_service_all on public.platform_approvals for all to service_role using (true) with check (true);

create table if not exists public.platform_test_runs (
  id uuid primary key default gen_random_uuid(),
  suite text not null,
  test_id text not null,
  category text not null,
  classification text not null check (classification in ('static', 'unit', 'integration', 'synthetic_e2e', 'live_safe_probe', 'manual_device')),
  environment text not null check (environment in ('simulation', 'staging', 'production_safe')),
  tenant_id uuid,
  facility_id uuid,
  seed text,
  commit_sha text,
  deployment_id text,
  started_by uuid references public.profiles (id) on delete set null,
  started_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz,
  status text not null default 'running' check (status in ('pass', 'fail', 'blocked', 'skipped', 'not_configured', 'running')),
  duration_ms integer,
  evidence jsonb not null default '{}'::jsonb,
  logs jsonb not null default '[]'::jsonb,
  correlation_id text not null,
  is_synthetic boolean not null default true
);
create index if not exists idx_platform_test_runs_started on public.platform_test_runs (started_at desc);
create index if not exists idx_platform_test_runs_suite on public.platform_test_runs (suite, started_at desc);
create index if not exists idx_platform_test_runs_correlation on public.platform_test_runs (correlation_id);
alter table public.platform_test_runs enable row level security;
drop policy if exists platform_test_runs_service_all on public.platform_test_runs;
create policy platform_test_runs_service_all on public.platform_test_runs for all to service_role using (true) with check (true);

create table if not exists public.platform_feature_flags (
  id uuid primary key default gen_random_uuid(),
  flag text not null unique,
  description text not null,
  owner text,
  risk_level text not null default 'low' check (risk_level in ('low', 'medium', 'high', 'critical')),
  default_enabled boolean not null default false,
  environment_values jsonb not null default '{}'::jsonb,
  expires_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
alter table public.platform_feature_flags enable row level security;
drop policy if exists platform_feature_flags_service_all on public.platform_feature_flags;
create policy platform_feature_flags_service_all on public.platform_feature_flags for all to service_role using (true) with check (true);

create table if not exists public.platform_support_tickets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  facility_id uuid,
  product text,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  severity text,
  status text not null default 'open' check (status in ('open', 'in_progress', 'waiting_customer', 'escalated', 'resolved', 'closed')),
  subject text not null,
  description text,
  owner_id uuid references public.profiles (id) on delete set null,
  sla_due_at timestamptz,
  incident_id uuid references public.platform_incidents (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
alter table public.platform_support_tickets enable row level security;
drop policy if exists platform_support_tickets_service_all on public.platform_support_tickets;
create policy platform_support_tickets_service_all on public.platform_support_tickets for all to service_role using (true) with check (true);

create table if not exists public.platform_support_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  facility_id uuid,
  reason text not null,
  scope text not null default 'tenant_config_read' check (scope in ('tenant_config_read', 'billing_read', 'integration_read')),
  ticket_id uuid references public.platform_support_tickets (id) on delete set null,
  requested_by uuid not null references public.profiles (id) on delete restrict,
  approved_by uuid references public.profiles (id) on delete set null,
  status text not null default 'requested' check (status in ('requested', 'active', 'expired', 'revoked', 'rejected')),
  expires_at timestamptz not null,
  correlation_id text,
  created_at timestamptz not null default timezone('utc', now())
);
alter table public.platform_support_sessions enable row level security;
drop policy if exists platform_support_sessions_service_all on public.platform_support_sessions;
create policy platform_support_sessions_service_all on public.platform_support_sessions for all to service_role using (true) with check (true);

create table if not exists public.platform_releases (
  id uuid primary key default gen_random_uuid(),
  product_id text not null,
  version text not null,
  commit_sha text,
  branch text,
  pr_url text,
  status text not null default 'draft' check (status in ('draft', 'candidate', 'staging', 'pilot', 'production', 'rolled_back', 'failed')),
  ci_status text,
  notes text,
  rollback_strategy text,
  approved_by uuid references public.profiles (id) on delete set null,
  approved_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
alter table public.platform_releases enable row level security;
drop policy if exists platform_releases_service_all on public.platform_releases;
create policy platform_releases_service_all on public.platform_releases for all to service_role using (true) with check (true);

create table if not exists public.platform_broadcasts (
  id uuid primary key default gen_random_uuid(),
  audience text not null default 'all_tenants',
  product text,
  tenant_id uuid,
  title text not null,
  body text not null,
  status text not null default 'draft' check (status in ('draft', 'previewed', 'sent', 'cancelled')),
  previewed_by uuid references public.profiles (id) on delete set null,
  sent_by uuid references public.profiles (id) on delete set null,
  sent_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);
alter table public.platform_broadcasts enable row level security;
drop policy if exists platform_broadcasts_service_all on public.platform_broadcasts;
create policy platform_broadcasts_service_all on public.platform_broadcasts for all to service_role using (true) with check (true);
