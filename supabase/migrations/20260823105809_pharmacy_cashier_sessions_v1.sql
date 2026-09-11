-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260823105809  name: pharmacy_cashier_sessions_v1
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.

alter table public.pharmacy_cashier_sessions
  add column if not exists cash_in numeric not null default 0,
  add column if not exists cash_out numeric not null default 0,
  add column if not exists cash_payment_total numeric not null default 0,
  add column if not exists cash_refund_total numeric not null default 0,
  add column if not exists variance_reason text,
  add column if not exists device_id text,
  add column if not exists opened_by uuid,
  add column if not exists till_code text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'pharmacy_cashier_sessions_status_check'
  ) then
    alter table public.pharmacy_cashier_sessions
      add constraint pharmacy_cashier_sessions_status_check
      check (status in ('open', 'active', 'closing', 'closed'));
  end if;
end $$;

create unique index if not exists pharmacy_cashier_sessions_one_open_cashier
  on public.pharmacy_cashier_sessions (tenant_id, cashier_id)
  where status in ('open', 'active', 'closing');

alter table public.pharmacy_cashier_sessions enable row level security;

drop policy if exists pharmacy_cashier_sessions_tenant on public.pharmacy_cashier_sessions;
create policy pharmacy_cashier_sessions_tenant
  on public.pharmacy_cashier_sessions
  for all
  using (
    is_platform_admin()
    or tenant_id = current_tenant_id()
  )
  with check (
    is_platform_admin()
    or tenant_id = current_tenant_id()
  );
