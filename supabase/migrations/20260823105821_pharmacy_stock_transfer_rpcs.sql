-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260823105821  name: pharmacy_stock_transfer_rpcs
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.

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
