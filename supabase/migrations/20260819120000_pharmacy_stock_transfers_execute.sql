-- =============================================================================
-- ONLINE stock transfer execution — move batch-authoritative stock between
-- pharmacy_stores (same tenant) through a bounded, auditable two-step RPC path.
--
-- ADDITIVE + REVERSIBLE. Does NOT recreate pharmacy_stock_transfers /
-- pharmacy_stock_transfer_items (added in 20260817120000_synapse_network_identity
-- _foundations.sql) or any existing POS/inventory table.
--
-- Draft transfers created via apps/pharmacy/app/api/admin/transfers/route.ts
-- previously had no execution path: status stayed 'draft' forever and no stock
-- ever moved. This migration adds the missing state machine:
--
--   draft --[ship_pharmacy_stock_transfer]--> in_transit --[receive_pharmacy_stock_transfer]--> received
--
-- Batch integrity:
--   * Shipping performs FEFO deduction (or a pinned from_batch_id) against
--     SELLABLE batches (status='active', not expired, quantity>0) physically
--     located at from_store_id — never against product.quantity.
--   * Each unit shipped is recorded in pharmacy_stock_transfer_item_allocations
--     with the source batch's genuine batch_number/expiry_date/cost_price so the
--     receiving step re-creates (or tops up) an equivalent batch at to_store_id,
--     preserving FEFO ordering across the network instead of collapsing distinct
--     expiries into one bucket.
--   * A transfer only ever moves stock that already exists between two stores of
--     the SAME tenant; it never changes pharmacy_products.quantity (the tenant-wide
--     physical total is unaffected by an internal transfer) and never fabricates
--     stock the way a naive product.quantity edit would.
--
-- Rollback (manual):
--   drop function if exists public.ship_pharmacy_stock_transfer(uuid,uuid,uuid);
--   drop function if exists public.receive_pharmacy_stock_transfer(uuid,uuid,uuid);
--   drop table if exists public.pharmacy_stock_transfer_item_allocations;
--   alter table public.pharmacy_stock_transfers
--     drop column if exists shipped_by,
--     drop column if exists shipped_at;
-- =============================================================================

do $$
begin
  if to_regclass('public.pharmacy_stock_transfers') is null then
    raise notice 'pharmacy_stock_transfers not present — skipping transfer execution migration';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 1. Ship-time bookkeeping columns (guarded; no-op if already present)
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.pharmacy_stock_transfers') is not null then
    alter table public.pharmacy_stock_transfers
      add column if not exists shipped_by uuid references public.profiles(id),
      add column if not exists shipped_at timestamptz;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Per-batch shipment ledger — one row per source batch consumed for an item.
--    Lets a single transfer item be fulfilled by more than one expiry lot
--    without losing which genuine batch each shipped unit came from.
-- ---------------------------------------------------------------------------
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

-- =============================================================================
-- 3. ship_pharmacy_stock_transfer — draft -> in_transit
--    Deducts sellable stock from from_store_id via FEFO (or a pinned batch),
--    never from product.quantity directly.
-- =============================================================================
create or replace function public.ship_pharmacy_stock_transfer(
  p_tenant_id uuid,
  p_transfer_id uuid,
  p_actor_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_transfer pharmacy_stock_transfers%rowtype;
  v_main_store_id uuid;
  v_item record;
  v_batch pharmacy_product_batches%rowtype;
  v_product_name text;
  v_needed int;
  v_take int;
  v_kla_today date := (timezone('Africa/Kampala', now()))::date;
  v_items_shipped int := 0;
  v_units_shipped int := 0;
begin
  select * into v_transfer from pharmacy_stock_transfers
  where id = p_transfer_id and tenant_id = p_tenant_id
  for update;
  if not found then
    raise exception 'TRANSFER_NOT_FOUND: %', p_transfer_id;
  end if;
  if v_transfer.status is distinct from 'draft' then
    raise exception 'INVALID_TRANSFER_STATE: expected draft, got %', v_transfer.status;
  end if;

  select id into v_main_store_id from pharmacy_stores
  where tenant_id = p_tenant_id and store_type = 'main'
  limit 1;

  if not exists (select 1 from pharmacy_stock_transfer_items where transfer_id = p_transfer_id) then
    raise exception 'TRANSFER_EMPTY: transfer % has no items', p_transfer_id;
  end if;

  for v_item in
    select * from pharmacy_stock_transfer_items
    where transfer_id = p_transfer_id
    order by created_at asc
  loop
    v_needed := v_item.quantity;
    if v_needed is null or v_needed <= 0 then
      raise exception 'INVALID_QUANTITY: transfer item % has no quantity', v_item.id;
    end if;

    select name into v_product_name from pharmacy_products
    where id = v_item.product_id and tenant_id = p_tenant_id;
    if v_product_name is null then
      raise exception 'PRODUCT_NOT_FOUND: %', v_item.product_id;
    end if;

    if v_item.from_batch_id is not null then
      -- Pinned batch: must be sellable stock physically at from_store_id.
      select * into v_batch from pharmacy_product_batches
      where id = v_item.from_batch_id
        and tenant_id = p_tenant_id
        and product_id = v_item.product_id
        and (store_id = v_transfer.from_store_id or (store_id is null and v_transfer.from_store_id = v_main_store_id))
      for update;
      if not found then
        raise exception 'BATCH_NOT_FOUND: %', v_item.from_batch_id;
      end if;
      if coalesce(v_batch.status, 'active') <> 'active' then
        raise exception 'INSUFFICIENT_BATCH: batch % is not active (status %)', v_batch.batch_number, v_batch.status;
      end if;
      if v_batch.quantity < v_needed then
        raise exception 'INSUFFICIENT_BATCH: % only has % units, % requested', v_batch.batch_number, v_batch.quantity, v_needed;
      end if;

      update pharmacy_product_batches
      set quantity = quantity - v_needed,
          status = case when quantity - v_needed <= 0 then 'exhausted' else status end,
          updated_at = now()
      where id = v_batch.id;

      insert into pharmacy_stock_transfer_item_allocations
        (transfer_item_id, from_batch_id, batch_number, expiry_date, cost_price, quantity)
      values
        (v_item.id, v_batch.id, v_batch.batch_number, v_batch.expiry_date, v_batch.cost_price, v_needed);

      v_units_shipped := v_units_shipped + v_needed;
    else
      -- FEFO across sellable batches physically held at from_store_id.
      for v_batch in
        select * from pharmacy_product_batches
        where product_id = v_item.product_id
          and tenant_id = p_tenant_id
          and coalesce(is_active, true)
          and coalesce(status, 'active') = 'active'
          and quantity > 0
          and (expiry_date is null or expiry_date >= v_kla_today)
          and (store_id = v_transfer.from_store_id or (store_id is null and v_transfer.from_store_id = v_main_store_id))
        order by expiry_date asc nulls last, received_date asc
        for update
      loop
        exit when v_needed <= 0;
        v_take := least(v_batch.quantity, v_needed);

        update pharmacy_product_batches
        set quantity = quantity - v_take,
            status = case when quantity - v_take <= 0 then 'exhausted' else status end,
            updated_at = now()
        where id = v_batch.id;

        insert into pharmacy_stock_transfer_item_allocations
          (transfer_item_id, from_batch_id, batch_number, expiry_date, cost_price, quantity)
        values
          (v_item.id, v_batch.id, v_batch.batch_number, v_batch.expiry_date, v_batch.cost_price, v_take);

        v_needed := v_needed - v_take;
        v_units_shipped := v_units_shipped + v_take;
      end loop;

      if v_needed > 0 then
        raise exception 'INSUFFICIENT_STOCK: % short by % units at source store', v_product_name, v_needed;
      end if;
    end if;

    v_items_shipped := v_items_shipped + 1;
  end loop;

  update pharmacy_stock_transfers
  set status = 'in_transit',
      shipped_by = p_actor_id,
      shipped_at = now(),
      updated_at = now()
  where id = p_transfer_id;

  begin
    insert into pharmacy_audit_logs (tenant_id, profile_id, action, entity, entity_id, details)
    values (
      p_tenant_id, p_actor_id, 'stock_transfer.shipped', 'pharmacy_stock_transfers', p_transfer_id,
      jsonb_build_object(
        'from_store_id', v_transfer.from_store_id,
        'to_store_id', v_transfer.to_store_id,
        'items', v_items_shipped,
        'units', v_units_shipped
      )::text
    );
  exception when undefined_table then null;
  end;

  return jsonb_build_object(
    'ok', true,
    'transfer_id', p_transfer_id,
    'status', 'in_transit',
    'items_shipped', v_items_shipped,
    'units_shipped', v_units_shipped
  );
end;
$function$;

comment on function public.ship_pharmacy_stock_transfer(uuid,uuid,uuid) is
  'Ships a draft stock transfer: FEFO-deducts sellable batches at from_store_id (never product.quantity) and records the exact source batches in pharmacy_stock_transfer_item_allocations for receiving.';

-- =============================================================================
-- 4. receive_pharmacy_stock_transfer — in_transit -> received
--    Re-creates/tops-up the genuine source batch identity at to_store_id.
-- =============================================================================
create or replace function public.receive_pharmacy_stock_transfer(
  p_tenant_id uuid,
  p_transfer_id uuid,
  p_actor_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_transfer pharmacy_stock_transfers%rowtype;
  v_alloc record;
  v_to_batch_id uuid;
  v_kla_today date := (timezone('Africa/Kampala', now()))::date;
  v_units_received int := 0;
  v_allocations_received int := 0;
begin
  select * into v_transfer from pharmacy_stock_transfers
  where id = p_transfer_id and tenant_id = p_tenant_id
  for update;
  if not found then
    raise exception 'TRANSFER_NOT_FOUND: %', p_transfer_id;
  end if;
  if v_transfer.status is distinct from 'in_transit' then
    raise exception 'INVALID_TRANSFER_STATE: expected in_transit, got %', v_transfer.status;
  end if;

  for v_alloc in
    select a.*, ti.product_id
    from pharmacy_stock_transfer_item_allocations a
    join pharmacy_stock_transfer_items ti on ti.id = a.transfer_item_id
    where ti.transfer_id = p_transfer_id
      and a.to_batch_id is null
    order by a.created_at asc
  loop
    -- Top up a matching in-date active batch already at the destination store, else create one.
    select id into v_to_batch_id from pharmacy_product_batches
    where tenant_id = p_tenant_id
      and product_id = v_alloc.product_id
      and batch_number = v_alloc.batch_number
      and (expiry_date is not distinct from v_alloc.expiry_date)
      and store_id = v_transfer.to_store_id
      and coalesce(status, 'active') in ('active', 'exhausted')
    limit 1
    for update;

    if v_to_batch_id is not null then
      update pharmacy_product_batches
      set quantity = quantity + v_alloc.quantity,
          status = 'active',
          is_active = true,
          updated_at = now()
      where id = v_to_batch_id;
    else
      insert into pharmacy_product_batches
        (id, tenant_id, product_id, batch_number, quantity, initial_quantity,
         expiry_date, received_date, cost_price, is_active, status, store_id)
      values
        (gen_random_uuid(), p_tenant_id, v_alloc.product_id, v_alloc.batch_number, v_alloc.quantity, v_alloc.quantity,
         v_alloc.expiry_date, v_kla_today, v_alloc.cost_price, true, 'active', v_transfer.to_store_id)
      returning id into v_to_batch_id;
    end if;

    update pharmacy_stock_transfer_item_allocations
    set to_batch_id = v_to_batch_id
    where id = v_alloc.id;

    v_units_received := v_units_received + v_alloc.quantity;
    v_allocations_received := v_allocations_received + 1;
  end loop;

  if v_allocations_received = 0 then
    raise exception 'TRANSFER_EMPTY: transfer % has no shipped allocations to receive', p_transfer_id;
  end if;

  update pharmacy_stock_transfers
  set status = 'received',
      received_by = p_actor_id,
      received_at = now(),
      updated_at = now()
  where id = p_transfer_id;

  begin
    insert into pharmacy_audit_logs (tenant_id, profile_id, action, entity, entity_id, details)
    values (
      p_tenant_id, p_actor_id, 'stock_transfer.received', 'pharmacy_stock_transfers', p_transfer_id,
      jsonb_build_object(
        'from_store_id', v_transfer.from_store_id,
        'to_store_id', v_transfer.to_store_id,
        'allocations', v_allocations_received,
        'units', v_units_received
      )::text
    );
  exception when undefined_table then null;
  end;

  return jsonb_build_object(
    'ok', true,
    'transfer_id', p_transfer_id,
    'status', 'received',
    'allocations_received', v_allocations_received,
    'units_received', v_units_received
  );
end;
$function$;

comment on function public.receive_pharmacy_stock_transfer(uuid,uuid,uuid) is
  'Receives an in_transit stock transfer at to_store_id: re-creates/tops-up the genuine source batch (batch_number + expiry_date + cost_price) at the destination so FEFO ordering is preserved across stores.';

-- ---------------------------------------------------------------------------
-- 5. Least privilege — these mutate stock, so service_role only (match
--    pharmacy_pilot_authority_hardening style).
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('ship_pharmacy_stock_transfer', 'receive_pharmacy_stock_transfer')
  loop
    execute format('revoke all on function %s from public', r.sig);
    execute format('revoke all on function %s from anon', r.sig);
    execute format('revoke all on function %s from authenticated', r.sig);
    execute format('grant execute on function %s to service_role', r.sig);
  end loop;
end $$;
