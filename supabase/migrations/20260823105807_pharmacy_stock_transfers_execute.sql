-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260823105807  name: pharmacy_stock_transfers_execute
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.

-- ONLINE stock transfer execution — additive
do $$
begin
  if to_regclass('public.pharmacy_stock_transfers') is not null then
    alter table public.pharmacy_stock_transfers
      add column if not exists shipped_by uuid references public.profiles(id),
      add column if not exists shipped_at timestamptz;
  end if;
end $$;

create table if not exists public.pharmacy_stock_transfer_item_allocations (
  id uuid primary key default gen_random_uuid(),
  transfer_item_id uuid not null references public.pharmacy_stock_transfer_items(id) on delete cascade,
  from_batch_id uuid not null,
  to_batch_id uuid,
  batch_number text not null,
  expiry_date date,
  cost_price numeric,
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now()
);

create index if not exists pharmacy_stock_transfer_item_allocations_item_idx
  on public.pharmacy_stock_transfer_item_allocations (transfer_item_id);

do $$
begin
  if to_regclass('public.pharmacy_stock_transfer_item_allocations') is not null then
    execute 'alter table public.pharmacy_stock_transfer_item_allocations enable row level security';
  end if;
end $$;

drop policy if exists pharmacy_stock_transfer_item_allocations_via_parent
  on public.pharmacy_stock_transfer_item_allocations;
create policy pharmacy_stock_transfer_item_allocations_via_parent
  on public.pharmacy_stock_transfer_item_allocations
  for all
  using (
    is_platform_admin()
    or exists (
      select 1
      from public.pharmacy_stock_transfer_items ti
      join public.pharmacy_stock_transfers tr on tr.id = ti.transfer_id
      where ti.id = transfer_item_id and tr.tenant_id = current_tenant_id()
    )
  )
  with check (
    is_platform_admin()
    or exists (
      select 1
      from public.pharmacy_stock_transfer_items ti
      join public.pharmacy_stock_transfers tr on tr.id = ti.transfer_id
      where ti.id = transfer_item_id and tr.tenant_id = current_tenant_id()
    )
  );
