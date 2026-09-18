-- Canonical hospital encounter payments (P1-008).
-- Application code already writes public.billing_payments
-- (packages/db/src/clinical-payment.ts). The original
-- 20260831180000_hospital_billing_payments.sql was quarantined
-- locally on 2026-09-11 and never applied to production.
-- Additive only — do not create a second payment store.

do $$
begin
  if to_regclass('public.billing_invoices') is null then
    raise exception 'public.billing_payments requires public.billing_invoices';
  end if;
end $$;

create table if not exists public.billing_payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  invoice_id uuid not null references public.billing_invoices(id) on delete cascade,
  encounter_id uuid references public.encounters(id) on delete set null,
  patient_id uuid references public.patients(id) on delete set null,
  amount numeric(12, 2) not null check (amount > 0),
  currency text not null default 'UGX',
  payment_method text not null,
  payment_ref text,
  receipt_number text,
  idempotency_key text,
  received_by uuid,
  notes text,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_billing_payments_idempotency
  on public.billing_payments (tenant_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists idx_billing_payments_invoice
  on public.billing_payments (tenant_id, invoice_id, created_at desc);

create index if not exists idx_billing_payments_encounter
  on public.billing_payments (tenant_id, encounter_id, created_at desc);

alter table public.billing_payments enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'billing_payments'
      and policyname = 'billing_payments_tenant_isolation'
  ) then
    create policy billing_payments_tenant_isolation
      on public.billing_payments
      for all
      using (tenant_id = public.current_tenant_id())
      with check (tenant_id = public.current_tenant_id());
  end if;
end $$;

comment on table public.billing_payments is
  'Hospital encounter payments against billing_invoices. Idempotent via (tenant_id, idempotency_key).';

-- Align lab_orders classification with tenants / persist layer.
-- Persist previously wrote "production", which is not a valid class.
do $$
begin
  if to_regclass('public.lab_orders') is not null
     and not exists (
       select 1 from pg_constraint where conname = 'lab_orders_data_classification_check'
     )
  then
    update public.lab_orders
    set data_classification = 'clinical'
    where data_classification = 'production';

    alter table public.lab_orders
      add constraint lab_orders_data_classification_check
      check (
        data_classification is null
        or data_classification in ('clinical', 'synthetic', 'operational')
      );
  end if;
end $$;

-- Additive RLS for facility lifecycle events (table already created by 20260918120000).
do $$
begin
  if to_regclass('public.facility_lifecycle_events') is null then
    return;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'facility_lifecycle_events'
      and policyname = 'facility_lifecycle_events_platform_admin'
  ) then
    create policy facility_lifecycle_events_platform_admin
      on public.facility_lifecycle_events
      for all
      using (public.is_platform_admin())
      with check (public.is_platform_admin());
  end if;
end $$;

grant select, insert, update on public.billing_payments to authenticated;
grant select, insert, update, delete on public.billing_payments to service_role;

notify pgrst, 'reload schema';
