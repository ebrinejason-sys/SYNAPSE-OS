-- Pharmacy: receive_pharmacy_stock must reject supplier / purchase-order / store ids
-- that belong to another tenant.
--
-- Before: p_supplier_id, p_purchase_order_id and p_store_id were never checked and
-- were written verbatim into pharmacy_audit_logs.details, so tenant A could record a
-- receipt "from" tenant B's supplier or against tenant B's PO.
--
-- Forward-safe: CREATE OR REPLACE with the identical 13-argument signature (grants
-- and callers unchanged); the body is the production definition (md5 of prosrc
-- 366814bd594319fac0689ab05338376a, verified identical locally and in prod on
-- 2026-10-02) plus three existence checks, and a new batch now falls back to the
-- product cost price when p_cost_price is null (the column is NOT NULL, so a receive
-- without cost previously failed with a 500). No data is modified.
-- Applied LOCALLY ONLY. Not applied to production.

CREATE OR REPLACE FUNCTION public.receive_pharmacy_stock(p_tenant_id uuid, p_product_id uuid, p_batch_number text, p_quantity integer, p_expiry_date date, p_cost_price numeric DEFAULT NULL::numeric, p_received_by uuid DEFAULT NULL::uuid, p_supplier_ref text DEFAULT NULL::text, p_selling_price numeric DEFAULT NULL::numeric, p_supplier_id uuid DEFAULT NULL::uuid, p_purchase_order_id uuid DEFAULT NULL::uuid, p_store_id uuid DEFAULT NULL::uuid, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- Tenant ownership of every referenced id (2026-10-02). A foreign supplier,
  -- purchase order or store is reported as not found and nothing is written.
  if p_supplier_id is not null and not exists (
    select 1 from pharmacy_suppliers where id = p_supplier_id and tenant_id = p_tenant_id
  ) then
    raise exception 'SUPPLIER_NOT_FOUND: %', p_supplier_id;
  end if;
  if p_purchase_order_id is not null and not exists (
    select 1 from pharmacy_purchase_orders where id = p_purchase_order_id and tenant_id = p_tenant_id
  ) then
    raise exception 'PURCHASE_ORDER_NOT_FOUND: %', p_purchase_order_id;
  end if;
  if p_store_id is not null and not exists (
    select 1 from pharmacy_stores where id = p_store_id and tenant_id = p_tenant_id
  ) then
    raise exception 'STORE_NOT_FOUND: %', p_store_id;
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
       p_expiry_date, v_kla_today, coalesce(p_cost_price, v_product.cost_price, 0), true, 'active')
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
