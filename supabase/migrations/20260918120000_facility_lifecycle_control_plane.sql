-- Additive facility lifecycle control plane.
-- Does not cascade-delete clinical or financial history.

alter table public.tenants
  add column if not exists lifecycle_status text not null default 'ACTIVE';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'tenants_lifecycle_status_check'
  ) then
    alter table public.tenants
      add constraint tenants_lifecycle_status_check
      check (lifecycle_status in ('ACTIVE', 'SUSPENDED', 'ARCHIVED', 'DELETION_PENDING', 'DELETED'));
  end if;
end $$;

update public.tenants
set lifecycle_status = case
  when coalesce(is_active, true) = false or lower(coalesce(status, '')) = 'suspended' then 'SUSPENDED'
  else 'ACTIVE'
end
where lifecycle_status is null or lifecycle_status = 'ACTIVE';

create table if not exists public.facility_lifecycle_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  actor_id uuid,
  action text not null,
  from_state text not null,
  to_state text not null,
  reason text,
  correlation_id uuid not null default gen_random_uuid(),
  impact jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists facility_lifecycle_events_tenant_idx
  on public.facility_lifecycle_events (tenant_id, created_at desc);

alter table public.facility_lifecycle_events enable row level security;
