-- =============================================================================
-- Phase 1 — Pharmacy inventory correctness: a single authoritative batch model.
--
-- ADDITIVE + REVERSIBLE. Does NOT create or drop any existing table. All changes
-- are guarded with IF NOT EXISTS / CREATE OR REPLACE so the migration is safe to
-- run against the live database (where pharmacy_products / pharmacy_product_batches
-- already exist — they are intentionally not (re)created here).
--
-- What it adds:
--   1. Batch lifecycle status (active | quarantined | damaged | recalled | expired)
--      + supporting columns on pharmacy_product_batches (no-op if already present).
--   2. A pharmacy_inventory_summary view exposing physical/sellable/expired/
--      quarantined/damaged/unbatched quantities per product (Kampala-date aware).
--   3. report_unbatched_positive_stock(tenant) — safe report of legacy products that
--      show positive product-level quantity but have no usable batch rows.
--   4. receive_pharmacy_stock(...) — new stock may enter ONLY through a receiving
--      transaction that creates/tops-up a real batch (genuine batch no + qty + expiry).
--   5. complete_pharmacy_sale(...) updated (same signature) so only 'active' status,
--      non-expired batches are sellable, and INSUFFICIENT_STOCK reports the sellable
--      quantity for the structured POS error contract.
--
-- ROLLBACK (manual, documented — not executed automatically):
--   drop view if exists public.pharmacy_inventory_summary;
--   drop function if exists public.report_unbatched_positive_stock(uuid);
--   drop function if exists public.receive_pharmacy_stock(uuid,uuid,text,integer,date,numeric,uuid,text);
--   -- restore complete_pharmacy_sale from 20260730120000_pos_sale_idempotency_in_rpc.sql
--   -- (the added batch columns are harmless to keep; drop only if required:)
--   -- alter table public.pharmacy_product_batches
--   --   drop column if exists status,
--   --   drop column if exists quarantine_reason,
--   --   drop column if exists recalled_at,
--   --   drop column if exists damaged_reason;
-- =============================================================================

-- 1. Batch lifecycle columns -------------------------------------------------
alter table if exists public.pharmacy_product_batches
  add column if not exists status text not null default 'active',
  add column if not exists manufacturer text,
  add column if not exists quarantine_reason text,
  add column if not exists recalled_at timestamptz,
  add column if not exists damaged_reason text;

-- Constrain status values (guarded: only add the constraint once).
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'pharmacy_product_batches_status_check'
  ) then
    alter table public.pharmacy_product_batches
      add constraint pharmacy_product_batches_status_check
      check (status in ('active','quarantined','damaged','recalled','expired'));
  end if;
end $$;

-- Backfill status for legacy rows: deactivated batches -> quarantined.
update public.pharmacy_product_batches
set status = 'quarantined'
where status = 'active' and coalesce(is_active, true) = false;

create index if not exists idx_pharmacy_product_batches_sellable
  on public.pharmacy_product_batches (tenant_id, product_id, expiry_date)
  where status = 'active' and quantity > 0;

-- 2. Authoritative inventory summary view ------------------------------------
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

comment on view public.pharmacy_inventory_summary is
  'Authoritative batch-derived stock per product. sellable_quantity is the only quantity POS may sell.';

-- 3. Unbatched legacy-stock report (safe; never fabricates batches) -----------
create or replace function public.report_unbatched_positive_stock(p_tenant_id uuid)
returns table (
  product_id uuid,
  name text,
  product_quantity integer,
  physical_quantity bigint,
  unbatched_quantity bigint
)
language sql
stable
security definer
set search_path to 'public'
as $$
  select s.product_id, s.name, s.product_quantity, s.physical_quantity, s.unbatched_quantity
  from public.pharmacy_inventory_summary s
  where s.tenant_id = p_tenant_id
    and s.unbatched_quantity > 0
  order by s.unbatched_quantity desc;
$$;

comment on function public.report_unbatched_positive_stock(uuid) is
  'Legacy products with positive product.quantity not backed by batch rows. These are NOT sellable until received with genuine batch data.';

-- 4. Receiving transaction: stock enters ONLY via a real batch ---------------
create or replace function public.receive_pharmacy_stock(
  p_tenant_id uuid,
  p_product_id uuid,
  p_batch_number text,
  p_quantity integer,
  p_expiry_date date,
  p_cost_price numeric default null,
  p_received_by uuid default null,
  p_supplier_ref text default null
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
    raise exception 'EXPIRED_RECEIPT: cannot receive stock that is already expired (% )', p_expiry_date;
  end if;

  select * into v_product from pharmacy_products
  where id = p_product_id and tenant_id = p_tenant_id for update;
  if not found then
    raise exception 'PRODUCT_NOT_FOUND: %', p_product_id;
  end if;

  -- Top up an existing active batch with the same number+expiry, else create one.
  select id into v_batch_id from pharmacy_product_batches
  where tenant_id = p_tenant_id and product_id = p_product_id
    and batch_number = p_batch_number
    and (expiry_date is not distinct from p_expiry_date)
    and coalesce(status, 'active') = 'active'
  limit 1;

  if v_batch_id is not null then
    update pharmacy_product_batches
    set quantity = quantity + p_quantity,
        cost_price = coalesce(p_cost_price, cost_price),
        updated_at = now()
    where id = v_batch_id;
  else
    insert into pharmacy_product_batches
      (id, tenant_id, product_id, batch_number, quantity, initial_quantity,
       expiry_date, received_date, cost_price, is_active, status)
    values
      (gen_random_uuid(), p_tenant_id, p_product_id, p_batch_number, p_quantity, p_quantity,
       p_expiry_date, v_kla_today, p_cost_price, true, 'active')
    returning id into v_batch_id;
  end if;

  -- Keep the denormalised product quantity in step with the batch ledger.
  update pharmacy_products
  set quantity = coalesce(quantity, 0) + p_quantity, updated_at = now()
  where id = p_product_id;

  -- Best-effort audit (table may not exist in every environment).
  begin
    insert into pharmacy_audit_logs (tenant_id, profile_id, action, entity, entity_id, details)
    values (p_tenant_id, p_received_by, 'stock.received', 'pharmacy_product_batches', v_batch_id,
            jsonb_build_object('product_id', p_product_id, 'batch_number', p_batch_number,
                               'quantity', p_quantity, 'expiry_date', p_expiry_date,
                               'supplier_ref', p_supplier_ref));
  exception when undefined_table then
    null;
  end;

  return jsonb_build_object('ok', true, 'batch_id', v_batch_id,
                            'product_id', p_product_id, 'received', p_quantity);
end;
$function$;

comment on function public.receive_pharmacy_stock(uuid,uuid,text,integer,date,numeric,uuid,text) is
  'The only sanctioned way to add sellable stock: creates/tops-up a real batch with genuine batch no, quantity and future expiry, and syncs product.quantity.';

-- 5. Sale RPC: exclude non-active batches + structured INSUFFICIENT_STOCK -----
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
  v_sellable int;
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

    -- FEFO over ONLY sellable batches: active status, non-expired, in stock.
    for v_batch in
      select * from pharmacy_product_batches
      where product_id = v_product.id
        and tenant_id = p_tenant_id
        and is_active
        and coalesce(status, 'active') = 'active'
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
      -- Report the total sellable quantity for the structured POS error contract.
      select coalesce(sum(quantity), 0) into v_sellable
      from pharmacy_product_batches
      where product_id = v_product.id and tenant_id = p_tenant_id
        and is_active and coalesce(status, 'active') = 'active' and quantity > 0
        and (expiry_date is null or expiry_date >= v_kla_today);
      raise exception 'INSUFFICIENT_STOCK: % short by % units (sellable %)',
        v_product.name, v_qty_needed, v_sellable;
    end if;

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
