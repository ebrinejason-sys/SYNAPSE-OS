-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260828175203  name: platform_control_plane_audit_incidents
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.

alter table public.hospitals
  add column if not exists facility_kind text not null default 'hospital';

alter table public.hospitals drop constraint if exists hospitals_facility_kind_check;
alter table public.hospitals
  add constraint hospitals_facility_kind_check
  check (facility_kind in (
    'hospital', 'health_centre', 'clinic', 'pharmacy', 'laboratory',
    'diagnostic_centre', 'insurer'
  ));

alter table public.platform_audit_events
  add column if not exists target_type text,
  add column if not exists target_id text,
  add column if not exists facility_id uuid,
  add column if not exists old_value jsonb,
  add column if not exists new_value jsonb,
  add column if not exists reason text,
  add column if not exists ip text,
  add column if not exists user_agent text,
  add column if not exists correlation_id text,
  add column if not exists risk_level text;

update public.platform_audit_events
set target_type = coalesce(target_type, resource_type)
where target_type is null;

alter table public.platform_audit_events drop constraint if exists platform_audit_events_risk_level_check;
alter table public.platform_audit_events
  add constraint platform_audit_events_risk_level_check
  check (risk_level is null or risk_level in ('low', 'medium', 'high', 'critical'));

create index if not exists idx_platform_audit_created
  on public.platform_audit_events (created_at desc);
create index if not exists idx_platform_audit_actor
  on public.platform_audit_events (actor_id, created_at desc);
create index if not exists idx_platform_audit_action
  on public.platform_audit_events (action, created_at desc);
create index if not exists idx_platform_audit_correlation
  on public.platform_audit_events (correlation_id);

alter table public.platform_audit_events enable row level security;

drop policy if exists platform_audit_service_write on public.platform_audit_events;
create policy platform_audit_service_write on public.platform_audit_events
for insert to service_role with check (true);

drop policy if exists platform_audit_service_read on public.platform_audit_events;
create policy platform_audit_service_read on public.platform_audit_events
for select to service_role using (true);

create or replace function public.forbid_platform_audit_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'platform_audit_events is append-only';
end;
$$;

drop trigger if exists trg_platform_audit_no_update on public.platform_audit_events;
create trigger trg_platform_audit_no_update
before update or delete on public.platform_audit_events
for each row execute function public.forbid_platform_audit_mutation();

comment on table public.platform_audit_events is
  'Append-only control-plane audit. Service-role insert only. Not a PHI browser.';

alter table public.platform_incidents
  add column if not exists title text,
  add column if not exists summary text,
  add column if not exists public_summary text,
  add column if not exists affected_services text[] not null default '{}',
  add column if not exists affected_tenants uuid[] not null default '{}',
  add column if not exists detected_at timestamptz,
  add column if not exists owner_id uuid references public.profiles (id) on delete set null,
  add column if not exists root_cause text,
  add column if not exists follow_up text,
  add column if not exists correlation_id text,
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

update public.platform_incidents
set
  title = coalesce(title, service),
  detected_at = coalesce(detected_at, started_at, created_at)
where title is null or detected_at is null;

alter table public.platform_incidents alter column service set default 'platform';

alter table public.platform_incidents drop constraint if exists platform_incidents_status_check;
alter table public.platform_incidents
  add constraint platform_incidents_status_check
  check (status in ('INVESTIGATING', 'IDENTIFIED', 'MITIGATING', 'MONITORING', 'RESOLVED'));

alter table public.platform_incidents drop constraint if exists platform_incidents_severity_check;
alter table public.platform_incidents
  add constraint platform_incidents_severity_check
  check (severity in ('SEV1', 'SEV2', 'SEV3', 'SEV4'));

create index if not exists idx_platform_incidents_status
  on public.platform_incidents (status, created_at desc);

alter table public.platform_incidents enable row level security;

drop policy if exists platform_incidents_service_all on public.platform_incidents;
create policy platform_incidents_service_all on public.platform_incidents
for all to service_role using (true) with check (true);
