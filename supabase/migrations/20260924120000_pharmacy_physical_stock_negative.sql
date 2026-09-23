-- Physical stock (Tally-style absolute count) + allow negative book stock on sale.
-- Purchases continue to enter via receive_pharmacy_stock; physical stock sets the counted qty.

-- Allow PHYSICAL on stock adjustment ledger
alter table public.pharmacy_stock_adjustments
  drop constraint if exists pharmacy_stock_adjustments_type_check;

alter table public.pharmacy_stock_adjustments
  add constraint pharmacy_stock_adjustments_type_check
  check (type = any (array[
    'INCREASE'::text,
    'DECREASE'::text,
    'CORRECTION'::text,
    'PHYSICAL'::text
  ]));

-- ---------------------------------------------------------------------------
-- set_pharmacy_physical_stock: absolute counted quantity (may be negative)
-- ---------------------------------------------------------------------------
create or replace function public.set_pharmacy_physical_stock(
  p_tenant_id uuid,
  p_product_id uuid,
  p_physical_qty integer,
  p_reason text,
  p_actor_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_product pharmacy_products%rowtype;
  v_prev int;
  v_new int;
  v_delta int;
  v_needed int;
  v_take int;
  v_batch pharmacy_product_batches%rowtype;
  v_batch_id uuid;
  v_kla_today date := (timezone('Africa/Kampala', now()))::date;
  v_phys_batch text := 'PHYS-' || to_char(v_kla_today, 'YYYYMMDD');
  v_neg_batch text := 'NEG-STOCK';
  v_cost numeric;
begin
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'REASON_REQUIRED: a reason is required for physical stock';
  end if;
  if p_physical_qty is null then
    raise exception 'INVALID_QUANTITY: physical quantity is required';
  end if;

  select * into v_product
  from pharmacy_products
  where id = p_product_id and tenant_id = p_tenant_id
  for update;
  if not found then
    raise exception 'PRODUCT_NOT_FOUND: %', p_product_id;
  end if;

  v_prev := coalesce(v_product.quantity, 0);
  v_new := p_physical_qty;
  v_delta := v_new - v_prev;
  v_cost := coalesce(v_product.cost_price, 0);

  if v_delta > 0 then
    -- Top up / create a physical-count batch so sellable FEFO stays consistent.
    select id into v_batch_id
    from pharmacy_product_batches
    where tenant_id = p_tenant_id
      and product_id = p_product_id
      and batch_number = v_phys_batch
      and coalesce(status, 'active') in ('active', 'exhausted')
    limit 1
    for update;

    if v_batch_id is not null then
      update pharmacy_product_batches
      set quantity = coalesce(quantity, 0) + v_delta,
          status = 'active',
          is_active = true,
          updated_at = now()
      where id = v_batch_id;
    else
      insert into pharmacy_product_batches
        (id, tenant_id, product_id, batch_number, quantity, initial_quantity,
         expiry_date, received_date, cost_price, is_active, status)
      values
        (gen_random_uuid(), p_tenant_id, p_product_id, v_phys_batch, v_delta, v_delta,
         '2099-12-31'::date, v_kla_today, v_cost, true, 'active')
      returning id into v_batch_id;
    end if;
  elsif v_delta < 0 then
    v_needed := abs(v_delta);
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

    -- Remaining shortfall → NEG-STOCK overdraft batch (supports negative book stock).
    if v_needed > 0 then
      select id into v_batch_id
      from pharmacy_product_batches
      where tenant_id = p_tenant_id
        and product_id = p_product_id
        and batch_number = v_neg_batch
      limit 1
      for update;

      if v_batch_id is not null then
        update pharmacy_product_batches
        set quantity = coalesce(quantity, 0) - v_needed,
            status = 'active',
            is_active = true,
            updated_at = now()
        where id = v_batch_id;
      else
        insert into pharmacy_product_batches
          (id, tenant_id, product_id, batch_number, quantity, initial_quantity,
           expiry_date, received_date, cost_price, is_active, status)
        values
          (gen_random_uuid(), p_tenant_id, p_product_id, v_neg_batch, -v_needed, 0,
           '2099-12-31'::date, v_kla_today, v_cost, true, 'active')
        returning id into v_batch_id;
      end if;
    end if;
  end if;

  update pharmacy_products
  set quantity = v_new, updated_at = now()
  where id = p_product_id;

  insert into pharmacy_stock_adjustments
    (tenant_id, product_id, quantity, type, reason, previous_qty, new_qty, created_by)
  values
    (p_tenant_id, p_product_id, v_delta, 'PHYSICAL', trim(p_reason), v_prev, v_new, p_actor_id);

  begin
    insert into pharmacy_audit_logs (tenant_id, profile_id, action, entity, entity_id, details)
    values (
      p_tenant_id, p_actor_id, 'stock.physical', 'pharmacy_products', p_product_id,
      jsonb_build_object('previous_qty', v_prev, 'new_qty', v_new, 'delta', v_delta, 'reason', trim(p_reason))
    );
  exception when others then null;
  end;

  return jsonb_build_object(
    'ok', true,
    'previous_qty', v_prev,
    'new_qty', v_new,
    'delta', v_delta,
    'product_id', p_product_id
  );
end;
$function$;

comment on function public.set_pharmacy_physical_stock(uuid, uuid, integer, text, uuid) is
  'Tally-style physical stock: set absolute counted quantity (may be negative). Records PHYSICAL adjustment.';

revoke all on function public.set_pharmacy_physical_stock(uuid, uuid, integer, text, uuid) from public;
revoke all on function public.set_pharmacy_physical_stock(uuid, uuid, integer, text, uuid) from anon;
revoke all on function public.set_pharmacy_physical_stock(uuid, uuid, integer, text, uuid) from authenticated;
grant execute on function public.set_pharmacy_physical_stock(uuid, uuid, integer, text, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Allow negative stock on POS sale (overdraft via NEG-STOCK batch)
-- ---------------------------------------------------------------------------
create or replace function public.complete_pharmacy_sale(
  p_tenant_id uuid,
  p_cashier_id uuid,
  p_items jsonb,
  p_payment_method text,
  p_session_id uuid DEFAULT NULL::uuid,
  p_cart_id uuid DEFAULT NULL::uuid,
  p_payment_ref text DEFAULT NULL::text,
  p_discount_total numeric DEFAULT 0,
  p_tax_amount numeric DEFAULT 0,
  p_patient_id uuid DEFAULT NULL::uuid,
  p_confirmed_by uuid DEFAULT NULL::uuid,
  p_idempotency_key text DEFAULT NULL::text
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_sale_id uuid := gen_random_uuid();
  v_item jsonb;
  v_product pharmacy_products%rowtype;
  v_batch pharmacy_product_batches%rowtype;
  v_qty_needed int;
  v_taken int;
  v_take int;
  v_unit_price numeric;
  v_line_discount numeric;
  v_disc_applied boolean;
  v_subtotal numeric := 0;
  v_item_discounts numeric := 0;
  v_discount numeric;
  v_total numeric;
  v_receipt text;
  v_seq int;
  v_kla_today date := (timezone('Africa/Kampala', now()))::date;
  v_confirmed_by uuid := coalesce(p_confirmed_by, p_cashier_id);
  v_key text := nullif(trim(coalesce(p_idempotency_key, '')), '');
  v_prior jsonb;
  v_claim_id uuid;
  v_result jsonb;
  v_neg_batch_id uuid;
  v_cost numeric;
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'SALE_EMPTY: items array is required';
  end if;
  if p_payment_method is null or length(trim(p_payment_method)) = 0 then
    raise exception 'PAYMENT_METHOD_REQUIRED';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_tenant_id::text || ':pos_receipt'));

  if v_key is not null then
    begin
      insert into public.pharmacy_sale_idempotency (
        tenant_id, idempotency_key, response_payload, created_by
      ) values (
        p_tenant_id, v_key, '{}'::jsonb, p_cashier_id
      )
      returning id into v_claim_id;
    exception when unique_violation then
      select response_payload into v_prior
      from public.pharmacy_sale_idempotency
      where tenant_id = p_tenant_id and idempotency_key = v_key;

      if v_prior is not null and v_prior <> '{}'::jsonb then
        return v_prior;
      end if;
      raise exception 'IDEMPOTENCY_IN_PROGRESS: retry shortly';
    end;
  end if;

  select count(*) + 1 into v_seq
  from pharmacy_pos_sales
  where tenant_id = p_tenant_id
    and (timezone('Africa/Kampala', created_at))::date = v_kla_today;

  v_receipt := 'R-' || to_char(v_kla_today, 'YYYYMMDD') || '-' || lpad(v_seq::text, 4, '0');

  insert into pharmacy_pos_sales
    (id, tenant_id, session_id, cart_id, cashier_id, patient_id, receipt_number,
     subtotal, discount_total, tax_amount, total_amount,
     payment_method, payment_ref, status, confirmed_by, confirmed_at)
  values
    (v_sale_id, p_tenant_id, p_session_id, p_cart_id, p_cashier_id, p_patient_id, v_receipt,
     0, 0, coalesce(p_tax_amount, 0), 0,
     p_payment_method, p_payment_ref, 'pending', null, null);

  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_product
    from pharmacy_products
    where id = (v_item->>'product_id')::uuid and tenant_id = p_tenant_id
    for update;

    if not found then
      raise exception 'PRODUCT_NOT_FOUND: %', v_item->>'product_id';
    end if;
    if coalesce(v_product.is_active, true) = false then
      raise exception 'PRODUCT_INACTIVE: %', v_product.name;
    end if;

    v_qty_needed := (v_item->>'quantity')::int;
    if v_qty_needed is null or v_qty_needed <= 0 then
      raise exception 'INVALID_QUANTITY for %', v_product.name;
    end if;

    v_unit_price := coalesce((v_item->>'unit_price')::numeric, v_product.price);
    if v_unit_price is null or v_unit_price < 0 then
      raise exception 'INVALID_PRICE for %', v_product.name;
    end if;
    v_line_discount := coalesce((v_item->>'discount_amount')::numeric, 0);
    v_disc_applied := false;
    v_taken := 0;
    v_cost := coalesce(v_product.cost_price, 0);

    -- FEFO over sellable batches first.
    for v_batch in
      select * from pharmacy_product_batches
      where product_id = v_product.id
        and tenant_id = p_tenant_id
        and is_active
        and coalesce(status, 'active') = 'active'
        and quantity > 0
        and (expiry_date is null or expiry_date >= v_kla_today)
        and ((v_item->>'batch_id') is null or id = (v_item->>'batch_id')::uuid)
        and batch_number <> 'NEG-STOCK'
      order by expiry_date asc nulls last, received_date asc
      for update
    loop
      exit when v_qty_needed = 0;
      v_take := least(v_batch.quantity, v_qty_needed);

      update pharmacy_product_batches
      set quantity = quantity - v_take, updated_at = now()
      where id = v_batch.id;

      insert into pharmacy_pos_sale_items
        (id, sale_id, tenant_id, product_id, batch_id, quantity, unit_price,
         discount_amount, stock_decremented)
      values
        (gen_random_uuid(), v_sale_id, p_tenant_id, v_product.id, v_batch.id, v_take, v_unit_price,
         case when not v_disc_applied then v_line_discount else 0 end,
         true);

      v_subtotal := v_subtotal + (v_take * v_unit_price);
      if not v_disc_applied then
        v_item_discounts := v_item_discounts + v_line_discount;
        v_disc_applied := true;
      end if;
      v_qty_needed := v_qty_needed - v_take;
      v_taken := v_taken + v_take;
    end loop;

    -- Allow negative book stock: remaining qty against NEG-STOCK overdraft batch.
    if v_qty_needed > 0 then
      select id into v_neg_batch_id
      from pharmacy_product_batches
      where tenant_id = p_tenant_id
        and product_id = v_product.id
        and batch_number = 'NEG-STOCK'
      limit 1
      for update;

      if v_neg_batch_id is null then
        insert into pharmacy_product_batches
          (id, tenant_id, product_id, batch_number, quantity, initial_quantity,
           expiry_date, received_date, cost_price, is_active, status)
        values
          (gen_random_uuid(), p_tenant_id, v_product.id, 'NEG-STOCK', 0, 0,
           '2099-12-31'::date, v_kla_today, v_cost, true, 'active')
        returning id into v_neg_batch_id;
      end if;

      update pharmacy_product_batches
      set quantity = coalesce(quantity, 0) - v_qty_needed,
          status = 'active',
          is_active = true,
          updated_at = now()
      where id = v_neg_batch_id;

      insert into pharmacy_pos_sale_items
        (id, sale_id, tenant_id, product_id, batch_id, quantity, unit_price,
         discount_amount, stock_decremented)
      values
        (gen_random_uuid(), v_sale_id, p_tenant_id, v_product.id, v_neg_batch_id, v_qty_needed, v_unit_price,
         case when not v_disc_applied then v_line_discount else 0 end,
         true);

      v_subtotal := v_subtotal + (v_qty_needed * v_unit_price);
      if not v_disc_applied then
        v_item_discounts := v_item_discounts + v_line_discount;
        v_disc_applied := true;
      end if;
      v_taken := v_taken + v_qty_needed;
      v_qty_needed := 0;
    end if;

    -- Book stock may go negative (Tally Allow Negative Stocks).
    update pharmacy_products
    set quantity = coalesce(quantity, 0) - v_taken, updated_at = now()
    where id = v_product.id;
  end loop;

  v_discount := coalesce(p_discount_total, 0) + v_item_discounts;
  v_total := v_subtotal - v_discount + coalesce(p_tax_amount, 0);
  if v_total < 0 then
    raise exception 'NEGATIVE_TOTAL: discount exceeds subtotal';
  end if;

  update pharmacy_pos_sales
  set subtotal = v_subtotal,
      discount_total = v_discount,
      total_amount = v_total,
      status = 'completed',
      confirmed_by = v_confirmed_by,
      confirmed_at = now(),
      updated_at = now()
  where id = v_sale_id;

  v_result := jsonb_build_object(
    'sale_id', v_sale_id,
    'receipt_number', v_receipt,
    'subtotal', v_subtotal,
    'discount_total', v_discount,
    'tax_amount', coalesce(p_tax_amount, 0),
    'total_amount', v_total,
    'status', 'completed'
  );

  if v_claim_id is not null then
    update public.pharmacy_sale_idempotency
    set sale_id = v_sale_id,
        response_payload = v_result
    where id = v_claim_id;
  end if;

  return v_result;
end;
$function$;

comment on function public.complete_pharmacy_sale(
  uuid, uuid, jsonb, text, uuid, uuid, text, numeric, numeric, uuid, uuid, text
) is
  'POS sale with FEFO then NEG-STOCK overdraft — book quantity may go negative.';
