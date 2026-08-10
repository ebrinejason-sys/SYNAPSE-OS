-- =============================================================================
-- SYNAPSE Pharm Pilot v1 — inventory authority hardening
--
-- ADDITIVE + REVERSIBLE. Assumes pharmacy_* tables already exist (live schema).
-- Depends on concepts introduced in 20260805130000_pharmacy_inventory_authority.sql
-- (batch status columns, receive_pharmacy_stock, complete_pharmacy_sale FEFO).
--
-- What it adds:
--   1. Extend receive_pharmacy_stock with selling price / supplier / PO / store / reason
--   2. adjust_pharmacy_batch_stock — batch-aware INCREASE/DECREASE/CORRECTION/DAMAGE/...
--   3. reverse_pharmacy_sale — idempotent void + stock restore (default quarantined)
--   4. Least-privilege EXECUTE: revoke direct client execution of privileged RPCs
--   5. Allow 'exhausted' in batch status check
--
-- ROLLBACK (manual):
--   drop function if exists public.adjust_pharmacy_batch_stock(...);
--   drop function if exists public.reverse_pharmacy_sale(...);
--   -- restore prior receive_pharmacy_stock signature from 20260805130000
-- =============================================================================

-- 0. Ensure batch status column exists (idempotent if prior migration applied)
alter table if exists public.pharmacy_product_batches
  add column if not exists status text not null default 'active',
  add column if not exists manufacturer text,
  add column if not exists quarantine_reason text,
  add column if not exists recalled_at timestamptz,
  add column if not exists damaged_reason text;

-- Expand status check to include exhausted
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'pharmacy_product_batches_status_check'
  ) then
    alter table public.pharmacy_product_batches
      drop constraint pharmacy_product_batches_status_check;
  end if;
  alter table public.pharmacy_product_batches
    add constraint pharmacy_product_batches_status_check
    check (status in ('active','quarantined','damaged','recalled','expired','exhausted'));
exception when undefined_table then
  null;
end $$;

-- Mark zero-qty active batches as exhausted (best-effort, non-destructive)
update public.pharmacy_product_batches
set status = 'exhausted'
where coalesce(status, 'active') = 'active'
  and coalesce(quantity, 0) <= 0
  and coalesce(is_active, true) = true;

-- =============================================================================
-- 1. receive_pharmacy_stock (extended) — drop prior overload(s) then recreate
-- =============================================================================
drop function if exists public.receive_pharmacy_stock(uuid,uuid,text,integer,date,numeric,uuid,text);
drop function if exists public.receive_pharmacy_stock(uuid,uuid,text,integer,date,numeric,uuid,text,numeric,uuid,uuid,uuid,text);

create or replace function public.receive_pharmacy_stock(
  p_tenant_id uuid,
  p_product_id uuid,
  p_batch_number text,
  p_quantity integer,
  p_expiry_date date,
  p_cost_price numeric default null,
  p_received_by uuid default null,
  p_supplier_ref text default null,
  p_selling_price numeric default null,
  p_supplier_id uuid default null,
  p_purchase_order_id uuid default null,
  p_store_id uuid default null,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_product pharmacy_products%rowtype;
  v_batch_id uuid;
  v_kla_today date := (timezone('Africa/Kampala', now()))::date;
begin
  if p_batch_number is null or length(trim(p_batch_number)) = 0 then
    raise exception 'REQUIRES_BATCH: a genuine batch number is required to receive stock';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'INVALID_QUANTITY: receiving quantity must be a positive whole number';
  end if;
  if p_expiry_date is null then
    raise exception 'REQUIRES_EXPIRY: a genuine expiry date is required to receive stock';
  end if;
  if p_expiry_date < v_kla_today then
    raise exception 'EXPIRED_RECEIPT: cannot receive stock that is already expired (%)', p_expiry_date;
  end if;

  select * into v_product from pharmacy_products
  where id = p_product_id and tenant_id = p_tenant_id for update;
  if not found then
    raise exception 'PRODUCT_NOT_FOUND: %', p_product_id;
  end if;

  select id into v_batch_id from pharmacy_product_batches
  where tenant_id = p_tenant_id and product_id = p_product_id
    and batch_number = trim(p_batch_number)
    and (expiry_date is not distinct from p_expiry_date)
    and coalesce(status, 'active') in ('active', 'exhausted')
  limit 1
  for update;

  if v_batch_id is not null then
    update pharmacy_product_batches
    set quantity = quantity + p_quantity,
        status = 'active',
        is_active = true,
        cost_price = coalesce(p_cost_price, cost_price),
        updated_at = now()
    where id = v_batch_id;
  else
    insert into pharmacy_product_batches
      (id, tenant_id, product_id, batch_number, quantity, initial_quantity,
       expiry_date, received_date, cost_price, is_active, status)
    values
      (gen_random_uuid(), p_tenant_id, p_product_id, trim(p_batch_number), p_quantity, p_quantity,
       p_expiry_date, v_kla_today, p_cost_price, true, 'active')
    returning id into v_batch_id;
  end if;

  update pharmacy_products
  set quantity = coalesce(quantity, 0) + p_quantity,
      price = coalesce(p_selling_price, price),
      cost_price = coalesce(p_cost_price, cost_price),
      updated_at = now()
  where id = p_product_id;

  begin
    insert into pharmacy_stock_adjustments (
      tenant_id, product_id, quantity, type, reason, previous_qty, new_qty, created_by
    ) values (
      p_tenant_id, p_product_id, p_quantity, 'INCREASE',
      coalesce(p_reason, format('Received batch %s', trim(p_batch_number))),
      greatest(coalesce(v_product.quantity, 0), 0),
      greatest(coalesce(v_product.quantity, 0), 0) + p_quantity,
      p_received_by
    );
  exception when undefined_table then
    null;
  end;

  begin
    insert into pharmacy_audit_logs (tenant_id, profile_id, action, entity, entity_id, details)
    values (
      p_tenant_id, p_received_by, 'stock.received', 'pharmacy_product_batches', v_batch_id,
      jsonb_build_object(
        'product_id', p_product_id,
        'batch_number', trim(p_batch_number),
        'quantity', p_quantity,
        'expiry_date', p_expiry_date,
        'cost_price', p_cost_price,
        'selling_price', p_selling_price,
        'supplier_ref', p_supplier_ref,
        'supplier_id', p_supplier_id,
        'purchase_order_id', p_purchase_order_id,
        'store_id', p_store_id,
        'reason', p_reason
      )::text
    );
  exception
    when undefined_table then null;
    when others then
      begin
        insert into pharmacy_audit_logs (tenant_id, profile_id, action, entity, entity_id, details)
        values (
          p_tenant_id, p_received_by, 'stock.received', 'pharmacy_product_batches', v_batch_id,
          format('Received %s units batch %s (expiry %s)', p_quantity, trim(p_batch_number), p_expiry_date)
        );
      exception when others then null;
      end;
  end;

  return jsonb_build_object(
    'ok', true,
    'batch_id', v_batch_id,
    'product_id', p_product_id,
    'received', p_quantity
  );
end;
$function$;

comment on function public.receive_pharmacy_stock(uuid,uuid,text,integer,date,numeric,uuid,text,numeric,uuid,uuid,uuid,text) is
  'Authoritative stock-in: creates/tops-up a real sellable batch and syncs product.quantity.';

-- =============================================================================
-- 2. adjust_pharmacy_batch_stock
-- =============================================================================
create or replace function public.adjust_pharmacy_batch_stock(
  p_tenant_id uuid,
  p_product_id uuid,
  p_quantity integer,
  p_type text,
  p_reason text,
  p_actor_id uuid,
  p_batch_id uuid default null,
  p_batch_number text default null,
  p_expiry_date date default null,
  p_cost_price numeric default null,
  p_restore_as text default 'active'
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_product pharmacy_products%rowtype;
  v_batch pharmacy_product_batches%rowtype;
  v_type text := upper(trim(coalesce(p_type, '')));
  v_prev int;
  v_new int;
  v_delta int;
  v_result jsonb;
  v_kla_today date := (timezone('Africa/Kampala', now()))::date;
  v_needed int;
  v_take int;
begin
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'INVALID_QUANTITY: adjustment reason is required';
  end if;

  select * into v_product from pharmacy_products
  where id = p_product_id and tenant_id = p_tenant_id for update;
  if not found then
    raise exception 'PRODUCT_NOT_FOUND: %', p_product_id;
  end if;

  -- INCREASE must go through receive semantics (genuine batch + expiry).
  if v_type = 'INCREASE' then
    return public.receive_pharmacy_stock(
      p_tenant_id, p_product_id,
      coalesce(p_batch_number, ''),
      p_quantity, p_expiry_date, p_cost_price, p_actor_id,
      null, null, null, null, null, p_reason
    );
  end if;

  if v_type in ('DAMAGE', 'QUARANTINE', 'RECALL') then
    if p_batch_id is null then
      raise exception 'BATCH_NOT_FOUND: batch_id is required for %', v_type;
    end if;
    select * into v_batch from pharmacy_product_batches
    where id = p_batch_id and tenant_id = p_tenant_id and product_id = p_product_id
    for update;
    if not found then
      raise exception 'BATCH_NOT_FOUND: %', p_batch_id;
    end if;

    update pharmacy_product_batches
    set status = case v_type
          when 'DAMAGE' then 'damaged'
          when 'QUARANTINE' then 'quarantined'
          when 'RECALL' then 'recalled'
        end,
        is_active = case when v_type = 'RECALL' then false else is_active end,
        damaged_reason = case when v_type = 'DAMAGE' then p_reason else damaged_reason end,
        quarantine_reason = case when v_type = 'QUARANTINE' then p_reason else quarantine_reason end,
        recalled_at = case when v_type = 'RECALL' then now() else recalled_at end,
        updated_at = now()
    where id = v_batch.id;

    begin
      insert into pharmacy_audit_logs (tenant_id, profile_id, action, entity, entity_id, details)
      values (p_tenant_id, p_actor_id, 'stock.' || lower(v_type), 'pharmacy_product_batches', v_batch.id, p_reason);
    exception when others then null;
    end;

    return jsonb_build_object('ok', true, 'batch_id', v_batch.id, 'status', lower(v_type));
  end if;

  if v_type = 'DECREASE' then
    if p_quantity is null or p_quantity <= 0 then
      raise exception 'INVALID_QUANTITY: decrease quantity must be positive';
    end if;
    v_needed := p_quantity;

    if p_batch_id is not null then
      select * into v_batch from pharmacy_product_batches
      where id = p_batch_id and tenant_id = p_tenant_id and product_id = p_product_id
      for update;
      if not found then
        raise exception 'BATCH_NOT_FOUND: %', p_batch_id;
      end if;
      if v_batch.quantity < v_needed then
        raise exception 'INSUFFICIENT_BATCH: only % units on batch', v_batch.quantity;
      end if;
      update pharmacy_product_batches
      set quantity = quantity - v_needed,
          status = case when quantity - v_needed <= 0 then 'exhausted' else status end,
          updated_at = now()
      where id = v_batch.id;
    else
      -- FEFO decrease across sellable batches
      for v_batch in
        select * from pharmacy_product_batches
        where product_id = p_product_id and tenant_id = p_tenant_id
          and is_active and coalesce(status, 'active') = 'active' and quantity > 0
          and (expiry_date is null or expiry_date >= v_kla_today)
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
        v_needed := v_needed - v_take;
      end loop;
      if v_needed > 0 then
        raise exception 'INSUFFICIENT_STOCK: short by % units', v_needed;
      end if;
    end if;

    v_prev := coalesce(v_product.quantity, 0);
    v_new := greatest(v_prev - p_quantity, 0);
    update pharmacy_products set quantity = v_new, updated_at = now() where id = p_product_id;

    begin
      insert into pharmacy_stock_adjustments (
        tenant_id, product_id, quantity, type, reason, previous_qty, new_qty, created_by
      ) values (
        p_tenant_id, p_product_id, p_quantity, 'DECREASE', p_reason, v_prev, v_new, p_actor_id
      );
    exception when undefined_table then null;
    end;

    return jsonb_build_object('ok', true, 'previous_qty', v_prev, 'new_qty', v_new, 'decreased', p_quantity);
  end if;

  if v_type = 'CORRECTION' then
    -- Batch-scoped absolute correction only — never invent batches.
    if p_batch_id is null then
      raise exception 'BATCH_NOT_FOUND: CORRECTION requires batch_id (do not correct product.quantity alone)';
    end if;
    if p_quantity is null or p_quantity < 0 then
      raise exception 'INVALID_QUANTITY: correction quantity must be >= 0';
    end if;
    select * into v_batch from pharmacy_product_batches
    where id = p_batch_id and tenant_id = p_tenant_id and product_id = p_product_id
    for update;
    if not found then
      raise exception 'BATCH_NOT_FOUND: %', p_batch_id;
    end if;

    v_delta := p_quantity - coalesce(v_batch.quantity, 0);
    update pharmacy_product_batches
    set quantity = p_quantity,
        status = case
          when p_quantity <= 0 then 'exhausted'
          when coalesce(status, 'active') = 'exhausted' then 'active'
          else status
        end,
        expiry_date = coalesce(p_expiry_date, expiry_date),
        cost_price = coalesce(p_cost_price, cost_price),
        updated_at = now()
    where id = v_batch.id;

    v_prev := coalesce(v_product.quantity, 0);
    v_new := greatest(v_prev + v_delta, 0);
    update pharmacy_products set quantity = v_new, updated_at = now() where id = p_product_id;

    begin
      insert into pharmacy_stock_adjustments (
        tenant_id, product_id, quantity, type, reason, previous_qty, new_qty, created_by
      ) values (
        p_tenant_id, p_product_id, v_delta, 'CORRECTION', p_reason, v_prev, v_new, p_actor_id
      );
    exception when undefined_table then null;
    end;

    return jsonb_build_object(
      'ok', true, 'batch_id', v_batch.id,
      'batch_quantity', p_quantity, 'previous_qty', v_prev, 'new_qty', v_new
    );
  end if;

  raise exception 'INVALID_QUANTITY: unsupported adjustment type %', p_type;
end;
$function$;

-- =============================================================================
-- 3. reverse_pharmacy_sale — never delete the sale; restore conservatively
-- =============================================================================
create or replace function public.reverse_pharmacy_sale(
  p_tenant_id uuid,
  p_sale_id uuid,
  p_actor_id uuid,
  p_reason text,
  p_restore_as text default 'quarantined'
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_sale pharmacy_pos_sales%rowtype;
  v_item record;
  v_restore text := lower(coalesce(nullif(trim(p_restore_as), ''), 'quarantined'));
  v_refund_amount numeric := 0;
  v_prev int;
  v_new int;
begin
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'INVALID_QUANTITY: refund reason is required';
  end if;
  if v_restore not in ('active', 'quarantined') then
    v_restore := 'quarantined';
  end if;

  select * into v_sale from pharmacy_pos_sales
  where id = p_sale_id and tenant_id = p_tenant_id
  for update;
  if not found then
    raise exception 'PRODUCT_NOT_FOUND: sale %', p_sale_id;
  end if;
  if v_sale.status = 'voided' then
    raise exception 'ALREADY_REFUNDED: sale % already voided', v_sale.receipt_number;
  end if;
  if v_sale.status is distinct from 'completed' then
    raise exception 'SALE_NOT_REFUNDABLE: status=%', v_sale.status;
  end if;

  for v_item in
    select * from pharmacy_pos_sale_items
    where sale_id = p_sale_id and tenant_id = p_tenant_id
    for update
  loop
    v_refund_amount := v_refund_amount + (coalesce(v_item.unit_price, 0) * coalesce(v_item.quantity, 0));

    if v_item.batch_id is not null then
      update pharmacy_product_batches
      set quantity = quantity + v_item.quantity,
          status = case
            when v_restore = 'active' then 'active'
            else 'quarantined'
          end,
          is_active = true,
          quarantine_reason = case
            when v_restore = 'quarantined' then coalesce(p_reason, 'Returned from sale void')
            else quarantine_reason
          end,
          updated_at = now()
      where id = v_item.batch_id and tenant_id = p_tenant_id;
    end if;

    if v_item.product_id is not null then
      select quantity into v_prev from pharmacy_products
      where id = v_item.product_id and tenant_id = p_tenant_id for update;
      v_prev := coalesce(v_prev, 0);
      v_new := v_prev + coalesce(v_item.quantity, 0);
      update pharmacy_products
      set quantity = v_new, updated_at = now()
      where id = v_item.product_id and tenant_id = p_tenant_id;

      begin
        insert into pharmacy_stock_adjustments (
          tenant_id, product_id, quantity, type, reason, previous_qty, new_qty, created_by
        ) values (
          p_tenant_id, v_item.product_id, v_item.quantity, 'INCREASE',
          format('Refund %s (%s): %s', v_sale.receipt_number, v_restore, p_reason),
          v_prev, v_new, p_actor_id
        );
      exception when undefined_table then null;
      end;
    end if;
  end loop;

  update pharmacy_pos_sales
  set status = 'voided',
      voided_reason = p_reason,
      voided_by = p_actor_id,
      voided_at = now(),
      updated_at = now()
  where id = p_sale_id and tenant_id = p_tenant_id;

  begin
    insert into pharmacy_audit_logs (tenant_id, profile_id, action, entity, entity_id, details)
    values (
      p_tenant_id, p_actor_id, 'REFUND_POS_SALE', 'POS_SALE', p_sale_id,
      format('Voided %s amount %s restore_as=%s reason=%s', v_sale.receipt_number, v_refund_amount, v_restore, p_reason)
    );
  exception when others then null;
  end;

  return jsonb_build_object(
    'ok', true,
    'sale_id', p_sale_id,
    'receipt_number', v_sale.receipt_number,
    'refund_amount', v_refund_amount,
    'restore_as', v_restore,
    'status', 'voided'
  );
end;
$function$;

-- =============================================================================
-- 4. Least privilege — privileged pharmacy RPCs are service_role only
-- =============================================================================
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'complete_pharmacy_sale',
        'receive_pharmacy_stock',
        'adjust_pharmacy_batch_stock',
        'reverse_pharmacy_sale',
        'report_unbatched_positive_stock'
      )
  loop
    execute format('revoke all on function %s from public', r.sig);
    execute format('revoke all on function %s from anon', r.sig);
    execute format('revoke all on function %s from authenticated', r.sig);
    execute format('grant execute on function %s to service_role', r.sig);
  end loop;
end $$;

-- Inventory summary view: ensure it exists (no-op create if prior migration present)
create or replace view public.pharmacy_inventory_summary as
with b as (
  select
    pb.tenant_id,
    pb.product_id,
    pb.quantity,
    pb.expiry_date,
    coalesce(pb.status, 'active') as status,
    (timezone('Africa/Kampala', now()))::date as kla_today
  from public.pharmacy_product_batches pb
)
select
  p.id                              as product_id,
  p.tenant_id                       as tenant_id,
  p.name                            as name,
  coalesce(p.quantity, 0)           as product_quantity,
  coalesce(sum(b.quantity), 0)      as physical_quantity,
  coalesce(sum(b.quantity) filter (
    where b.status = 'active'
      and b.quantity > 0
      and (b.expiry_date is null or b.expiry_date >= b.kla_today)
  ), 0)                             as sellable_quantity,
  coalesce(sum(b.quantity) filter (
    where b.expiry_date is not null and b.expiry_date < b.kla_today
  ), 0)                             as expired_quantity,
  coalesce(sum(b.quantity) filter (where b.status = 'quarantined'), 0) as quarantined_quantity,
  coalesce(sum(b.quantity) filter (where b.status = 'damaged'), 0)     as damaged_quantity,
  greatest(coalesce(p.quantity, 0) - coalesce(sum(b.quantity), 0), 0)  as unbatched_quantity
from public.pharmacy_products p
left join b on b.product_id = p.id and b.tenant_id = p.tenant_id
group by p.id, p.tenant_id, p.name, p.quantity;
