-- =============================================================================
-- ONE INVENTORY TRUTH — authoritative stock-adjustment RPC + function hardening.
--
-- Establishes a single controlled domain operation for stock adjustments so Web
-- and Expo never independently mutate quantities. Together with the existing
-- complete_pharmacy_sale (sales) and receive_pharmacy_stock (receiving) RPCs, ALL
-- stock changes now flow through batch-authoritative, transactional, audited
-- functions and keep pharmacy_products.quantity == SUM(batch quantities).
--
-- ADDITIVE + REVERSIBLE. Guarded with CREATE OR REPLACE / IF NOT EXISTS. No table
-- is created or dropped. Review against the live schema before `supabase db push`.
--
-- Rollback: drop the two functions below and restore prior GRANTs if required.
-- =============================================================================

-- Recompute the denormalised product quantity from its batch ledger (physical sum).
create or replace function public.recompute_pharmacy_product_quantity(
  p_tenant_id uuid,
  p_product_id uuid
)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_sum integer;
begin
  select coalesce(sum(quantity), 0) into v_sum
  from pharmacy_product_batches
  where tenant_id = p_tenant_id and product_id = p_product_id;

  update pharmacy_products
  set quantity = v_sum, updated_at = now()
  where id = p_product_id and tenant_id = p_tenant_id;

  return v_sum;
end;
$function$;

-- Authoritative stock adjustment.
--   * p_batch_id set  -> adjust that batch by p_delta (may set status: quarantined/damaged/recalled/active).
--   * p_batch_id null -> p_delta must be negative; deducts |p_delta| across sellable batches FEFO
--                        (shrinkage / count-down). Increases without a batch are rejected — new stock
--                        must enter via receive_pharmacy_stock so batch/expiry are genuine.
-- Records a movement in pharmacy_stock_adjustments, keeps product.quantity in sync, and audits.
create or replace function public.adjust_pharmacy_stock(
  p_tenant_id uuid,
  p_product_id uuid,
  p_delta integer,
  p_reason text,
  p_actor uuid,
  p_batch_id uuid default null,
  p_set_status text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_product pharmacy_products%rowtype;
  v_batch pharmacy_product_batches%rowtype;
  v_prev_product integer;
  v_new_product integer;
  v_remaining integer;
  v_take integer;
begin
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'REASON_REQUIRED: a reason is required for every stock adjustment';
  end if;
  if p_set_status is not null and p_set_status not in ('active','quarantined','damaged','recalled','expired') then
    raise exception 'INVALID_STATUS: %', p_set_status;
  end if;

  select * into v_product from pharmacy_products
  where id = p_product_id and tenant_id = p_tenant_id for update;
  if not found then
    raise exception 'PRODUCT_NOT_FOUND: %', p_product_id;
  end if;
  v_prev_product := coalesce(v_product.quantity, 0);

  if p_batch_id is not null then
    select * into v_batch from pharmacy_product_batches
    where id = p_batch_id and tenant_id = p_tenant_id and product_id = p_product_id for update;
    if not found then
      raise exception 'BATCH_NOT_FOUND: %', p_batch_id;
    end if;

    update pharmacy_product_batches
    set quantity = greatest(coalesce(quantity,0) + p_delta, 0),
        status = coalesce(p_set_status, status),
        updated_at = now()
    where id = p_batch_id;

  elsif p_delta < 0 then
    -- FEFO deduction across sellable batches.
    v_remaining := abs(p_delta);
    for v_batch in
      select * from pharmacy_product_batches
      where product_id = p_product_id and tenant_id = p_tenant_id
        and coalesce(status,'active') = 'active' and quantity > 0
      order by expiry_date asc nulls last, received_date asc
      for update
    loop
      exit when v_remaining = 0;
      v_take := least(v_batch.quantity, v_remaining);
      update pharmacy_product_batches
      set quantity = quantity - v_take, updated_at = now()
      where id = v_batch.id;
      v_remaining := v_remaining - v_take;
    end loop;
    if v_remaining > 0 then
      raise exception 'INSUFFICIENT_STOCK: % short by % units for adjustment', v_product.name, v_remaining;
    end if;
  else
    raise exception 'REQUIRES_BATCH: stock increases must enter through receiving (batch + expiry)';
  end if;

  -- Keep product.quantity authoritative (= sum of batches).
  v_new_product := public.recompute_pharmacy_product_quantity(p_tenant_id, p_product_id);

  insert into pharmacy_stock_adjustments
    (tenant_id, product_id, quantity, type, reason, previous_qty, new_qty, created_by)
  values
    (p_tenant_id, p_product_id, p_delta,
     case when p_delta >= 0 then 'INCREASE' else 'DECREASE' end,
     p_reason, v_prev_product, v_new_product, p_actor);

  begin
    insert into pharmacy_audit_logs (tenant_id, profile_id, action, entity, entity_id, details)
    values (p_tenant_id, p_actor, 'STOCK_ADJUSTMENT', 'pharmacy_products', p_product_id,
            jsonb_build_object('delta', p_delta, 'reason', p_reason, 'batch_id', p_batch_id,
                               'previous', v_prev_product, 'new', v_new_product, 'set_status', p_set_status));
  exception when undefined_table then
    null;
  end;

  return jsonb_build_object('ok', true, 'product_id', p_product_id,
                            'previous_quantity', v_prev_product, 'new_quantity', v_new_product);
end;
$function$;

-- ---------------------------------------------------------------------------
-- Function permission hardening: SECURITY DEFINER functions must not be callable
-- by anon; grant execute only to authenticated + service_role (the server clients).
-- ---------------------------------------------------------------------------
do $$
declare
  fn text;
  sig text;
begin
  foreach sig in array array[
    'public.complete_pharmacy_sale(uuid,uuid,jsonb,text,uuid,uuid,text,numeric,numeric,uuid,uuid,text)',
    'public.receive_pharmacy_stock(uuid,uuid,text,integer,date,numeric,uuid,text)',
    'public.adjust_pharmacy_stock(uuid,uuid,integer,text,uuid,uuid,text)',
    'public.recompute_pharmacy_product_quantity(uuid,uuid)',
    'public.report_unbatched_positive_stock(uuid)'
  ] loop
    begin
      execute format('revoke all on function %s from public', sig);
      execute format('revoke all on function %s from anon', sig);
      execute format('grant execute on function %s to authenticated', sig);
      execute format('grant execute on function %s to service_role', sig);
    exception when undefined_function then
      -- function/signature not present in this environment; skip safely.
      null;
    end;
  end loop;
end $$;
