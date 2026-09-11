-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260823105844  name: pharmacy_stock_transfer_receive_rpc
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.

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
