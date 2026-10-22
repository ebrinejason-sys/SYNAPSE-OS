create or replace function public.receive_pharmacy_purchase_atomic(
  p_tenant_id uuid,
  p_purchase_id uuid,
  p_received_by uuid,
  p_line_settings jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_purchase public.pharmacy_purchases%rowtype;
  v_item public.pharmacy_purchase_items%rowtype;
  v_existing_cost numeric;
  v_cost_price numeric;
  v_batch_id uuid;
  v_received integer;
  v_settings jsonb;
  v_receipt jsonb;
  v_results jsonb;
  v_ordered integer;
  v_order_received integer;
begin
  if p_tenant_id is null or p_purchase_id is null then
    raise exception 'PURCHASE_RECEIPT_INVALID';
  end if;
  if jsonb_typeof(coalesce(p_line_settings, '{}'::jsonb)) <> 'object' then
    raise exception 'PURCHASE_RECEIPT_SETTINGS_INVALID';
  end if;

  select * into v_purchase
  from public.pharmacy_purchases
  where id = p_purchase_id and tenant_id = p_tenant_id
  for update;
  if not found then
    raise exception 'PURCHASE_NOT_FOUND';
  end if;
  if v_purchase.status = 'CANCELLED' then
    raise exception 'PURCHASE_CANCELLED';
  end if;

  if v_purchase.status <> 'RECEIVED' then
    perform pg_advisory_xact_lock(hashtext(p_tenant_id::text || ':pharmacy_accounting_periods'));
    if exists (
      select 1 from public.pharmacy_accounting_periods
      where tenant_id = p_tenant_id and status = 'closed'
        and v_purchase.purchase_date between period_start and period_end
    ) then
      raise exception 'ACCOUNTING_PERIOD_CLOSED: %', v_purchase.purchase_date;
    end if;

    for v_item in
      select * from public.pharmacy_purchase_items
      where purchase_id = p_purchase_id and tenant_id = p_tenant_id
      order by created_at, id
      for update
    loop
      if v_item.product_id is null or nullif(trim(v_item.batch_number), '') is null
        or v_item.expiry_date is null then
        raise exception 'PURCHASE_RECEIPT_LINE_INVALID: %', v_item.id;
      end if;

      v_received := greatest(coalesce(v_item.received_quantity, 0), 0);
      if v_received >= v_item.quantity then
        continue;
      end if;

      v_settings := coalesce(p_line_settings->v_item.id::text, '{}'::jsonb);
      select cost_price into v_existing_cost
      from public.pharmacy_product_batches
      where tenant_id = p_tenant_id
        and product_id = v_item.product_id
        and batch_number = trim(v_item.batch_number)
        and expiry_date is not distinct from v_item.expiry_date
        and coalesce(status, 'active') in ('active', 'exhausted')
      limit 1;
      v_cost_price := case
        when found and v_existing_cost is not null and v_existing_cost <> v_item.unit_cost then null
        else v_item.unit_cost
      end;

      v_receipt := public.receive_pharmacy_stock(
        p_tenant_id,
        v_item.product_id,
        v_item.batch_number,
        v_item.quantity - v_received,
        v_item.expiry_date,
        v_cost_price,
        p_received_by,
        coalesce(v_purchase.supplier_invoice_no, v_purchase.purchase_no),
        case
          when coalesce((v_settings->>'updateSellingPrice')::boolean, false)
            then nullif(v_settings->>'sellingPrice', '')::numeric
          else null
        end,
        v_purchase.supplier_id,
        v_purchase.purchase_order_id,
        v_purchase.store_id,
        'Purchase ' || v_purchase.purchase_no
      );
      v_batch_id := nullif(v_receipt->>'batch_id', '')::uuid;

      update public.pharmacy_purchase_items
      set received_quantity = v_item.quantity,
          batch_id = v_batch_id
      where id = v_item.id and tenant_id = p_tenant_id;

      if v_item.purchase_order_item_id is not null then
        update public.pharmacy_purchase_order_items
        set received_quantity = coalesce(received_quantity, 0) + v_item.quantity - v_received
        where id = v_item.purchase_order_item_id and tenant_id = p_tenant_id;
      end if;
    end loop;

    if not exists (
      select 1 from public.pharmacy_purchase_items
      where purchase_id = p_purchase_id and tenant_id = p_tenant_id
    ) then
      raise exception 'PURCHASE_RECEIPT_LINES_REQUIRED';
    end if;

    update public.pharmacy_purchases
    set status = 'RECEIVED',
        received_by = p_received_by,
        received_date = coalesce(received_date, (timezone('Africa/Kampala', now()))::date),
        updated_at = now()
    where id = p_purchase_id and tenant_id = p_tenant_id;

    if v_purchase.purchase_order_id is not null then
      select coalesce(sum(quantity), 0), coalesce(sum(received_quantity), 0)
      into v_ordered, v_order_received
      from public.pharmacy_purchase_order_items
      where purchase_order_id = v_purchase.purchase_order_id and tenant_id = p_tenant_id;

      update public.pharmacy_purchase_orders
      set status = case
            when v_order_received <= 0 then 'SENT'
            when v_order_received >= v_ordered then 'RECEIVED'
            else 'PARTIALLY_RECEIVED'
          end,
          updated_at = now()
      where id = v_purchase.purchase_order_id and tenant_id = p_tenant_id;
    end if;
  end if;

  select coalesce(
    jsonb_agg(jsonb_build_object(
      'productId', product_id,
      'batchId', coalesce(batch_id::text, ''),
      'quantity', received_quantity,
      'purchaseItemId', id
    ) order by created_at, id),
    '[]'::jsonb
  ) into v_results
  from public.pharmacy_purchase_items
  where purchase_id = p_purchase_id and tenant_id = p_tenant_id
    and received_quantity > 0;

  return jsonb_build_object(
    'ok', true,
    'purchaseId', p_purchase_id,
    'purchaseNo', v_purchase.purchase_no,
    'received', v_results
  );
end;
$function$;

revoke all on function public.receive_pharmacy_purchase_atomic(uuid, uuid, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.receive_pharmacy_purchase_atomic(uuid, uuid, uuid, jsonb)
  to service_role;
