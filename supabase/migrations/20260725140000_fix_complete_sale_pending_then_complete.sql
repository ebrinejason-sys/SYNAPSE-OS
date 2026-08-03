-- Fix complete_pharmacy_sale vs append-only guard.
-- The RPC inserted status='completed' with zero totals, then UPDATEd financial
-- fields. guard_pos_sale_mutation() blocks financial mutations on completed
-- sales, so every POS sale failed with APPEND_ONLY.
--
-- Fix: insert as 'pending', finalize totals + status='completed' in one UPDATE.

CREATE OR REPLACE FUNCTION public.complete_pharmacy_sale(
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
  p_confirmed_by uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'SALE_EMPTY: items array is required';
  end if;
  if p_payment_method is null or length(trim(p_payment_method)) = 0 then
    raise exception 'PAYMENT_METHOD_REQUIRED';
  end if;

  -- Serialize per-tenant receipt numbering within this transaction
  perform pg_advisory_xact_lock(hashtext(p_tenant_id::text || ':pos_receipt'));

  select count(*) + 1 into v_seq
  from pharmacy_pos_sales
  where tenant_id = p_tenant_id
    and (timezone('Africa/Kampala', created_at))::date = v_kla_today;

  v_receipt := 'R-' || to_char(v_kla_today, 'YYYYMMDD') || '-' || lpad(v_seq::text, 4, '0');

  -- Pending until totals are known — append-only guard blocks financial UPDATEs on completed rows
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

    -- FEFO: earliest expiry first, skip expired, lock rows
    for v_batch in
      select * from pharmacy_product_batches
      where product_id = v_product.id
        and tenant_id = p_tenant_id
        and is_active
        and quantity > 0
        and (expiry_date is null or expiry_date >= v_kla_today)
        and ((v_item->>'batch_id') is null or id = (v_item->>'batch_id')::uuid)
      order by expiry_date asc nulls last, received_date asc
      for update
    loop
      exit when v_qty_needed = 0;
      v_take := least(v_batch.quantity, v_qty_needed);

      update pharmacy_product_batches
      set quantity = quantity - v_take, updated_at = now()
      where id = v_batch.id;

      -- line_total is a GENERATED column; do not insert it explicitly.
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

    if v_qty_needed > 0 then
      raise exception 'INSUFFICIENT_STOCK: % short by % units', v_product.name, v_qty_needed;
    end if;

    -- keep denormalized product quantity consistent with batch truth
    update pharmacy_products
    set quantity = greatest(quantity - v_taken, 0), updated_at = now()
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

  return jsonb_build_object(
    'sale_id', v_sale_id,
    'receipt_number', v_receipt,
    'subtotal', v_subtotal,
    'discount_total', v_discount,
    'tax_amount', coalesce(p_tax_amount, 0),
    'total_amount', v_total,
    'status', 'completed'
  );
end;
$function$;

COMMENT ON FUNCTION public.complete_pharmacy_sale IS
  'Atomic POS sale: FEFO batch decrement, receipt number, finalized as completed after totals.';
