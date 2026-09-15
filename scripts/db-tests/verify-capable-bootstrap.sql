-- Verify-capable additive objects for disposable RC1 / pharmacy integration.
-- NOT a substitute for full migration replay (see migration-replay evidence).
-- Safe to re-run (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).

-- Patients fields used by pharmacy hospital integration fixtures
alter table public.patients add column if not exists dob date;
alter table public.patients add column if not exists full_name text;
alter table public.patients add column if not exists sex text;
alter table public.patients add column if not exists updated_at timestamptz not null default now();

-- Hospitals profile (hospital_modules already present on lab-rc1 bootstrap)
create table if not exists public.hospitals (
  id uuid primary key,
  name text not null,
  subdomain text not null,
  type text not null default 'general',
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create unique index if not exists idx_hospitals_subdomain on public.hospitals (subdomain);

-- Minimal pharmacy catalogue surface (dispense RPC / batches may still be absent)
create table if not exists public.pharmacy_suppliers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  address text,
  contact_person text,
  notes text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.pharmacy_products (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  description text,
  category text not null default 'General',
  sku text not null,
  barcode text,
  price numeric(14,2) not null,
  cost_price numeric(14,2) not null,
  quantity integer not null default 0,
  reorder_level integer not null default 10,
  unit_of_measure text not null default 'Tablet',
  expiry_date date,
  manufacturer text,
  batch_number text,
  is_active boolean default true,
  strength text,
  dosage_form text,
  active_ingredient text,
  generic_name text,
  side_effects text,
  storage_instructions text,
  regulatory_id text,
  requires_prescription boolean default false,
  supplier_id uuid references public.pharmacy_suppliers(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(tenant_id, sku)
);
create index if not exists idx_pharm_products_tenant on public.pharmacy_products(tenant_id);

grant select, insert, update, delete on public.hospitals to anon, authenticated, service_role;
grant select, insert, update, delete on public.pharmacy_suppliers to anon, authenticated, service_role;
grant select, insert, update, delete on public.pharmacy_products to anon, authenticated, service_role;

notify pgrst, 'reload schema';

-- Round 2: columns + tasks + batches + receive RPC (for pharmacy integration)
alter table public.hospitals add column if not exists facility_kind text not null default 'hospital';
alter table public.encounters add column if not exists is_deleted boolean not null default false;
alter table public.encounters add column if not exists full_name text; -- noop if unused

create table if not exists public.pharmacy_product_batches (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  product_id uuid not null references public.pharmacy_products(id) on delete cascade,
  batch_number text not null,
  quantity integer not null,
  initial_quantity integer not null,
  expiry_date date not null,
  received_date date default (timezone('Africa/Kampala', now()))::date,
  cost_price numeric(14,2),
  is_active boolean default true,
  status text default 'active',
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(product_id, batch_number)
);
alter table public.pharmacy_product_batches add column if not exists status text default 'active';

create table if not exists public.department_tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  facility_id uuid,
  hospital_id uuid references public.hospitals(id) on delete set null,
  patient_id uuid references public.patients(id) on delete set null,
  person_id uuid,
  encounter_id uuid,
  requester_id uuid,
  owner_department text not null,
  owner_role text,
  task_type text not null,
  priority text not null default 'ROUTINE',
  status text not null default 'REQUESTED',
  title text not null,
  description text,
  source_resource text,
  source_id uuid,
  correlation_id uuid,
  causation_id uuid,
  idempotency_key text,
  due_at timestamptz,
  accepted_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  assigned_to uuid,
  result_summary text,
  metadata jsonb default '{}',
  is_synthetic boolean not null default false,
  simulation_run_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists idx_department_tasks_idempotency
  on public.department_tasks (tenant_id, idempotency_key) where idempotency_key is not null;

create or replace function public.receive_pharmacy_stock(
  p_tenant_id uuid,
  p_product_id uuid,
  p_batch_number text,
  p_quantity integer,
  p_expiry_date date,
  p_cost_price numeric default null,
  p_received_by uuid default null,
  p_supplier_ref text default null
) returns jsonb
language plpgsql security definer set search_path to 'public'
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
  select * into v_product from pharmacy_products where id = p_product_id and tenant_id = p_tenant_id for update;
  if not found then raise exception 'PRODUCT_NOT_FOUND: %', p_product_id; end if;
  select id into v_batch_id from pharmacy_product_batches
  where tenant_id = p_tenant_id and product_id = p_product_id
    and batch_number = p_batch_number
    and (expiry_date is not distinct from p_expiry_date)
    and coalesce(status, 'active') = 'active' limit 1;
  if v_batch_id is not null then
    update pharmacy_product_batches set quantity = quantity + p_quantity,
      cost_price = coalesce(p_cost_price, cost_price), updated_at = now() where id = v_batch_id;
  else
    insert into pharmacy_product_batches
      (id, tenant_id, product_id, batch_number, quantity, initial_quantity, expiry_date, received_date, cost_price, is_active, status)
    values (gen_random_uuid(), p_tenant_id, p_product_id, p_batch_number, p_quantity, p_quantity,
            p_expiry_date, v_kla_today, p_cost_price, true, 'active')
    returning id into v_batch_id;
  end if;
  update pharmacy_products set quantity = coalesce(quantity, 0) + p_quantity, updated_at = now() where id = p_product_id;
  return jsonb_build_object('ok', true, 'batch_id', v_batch_id, 'product_id', p_product_id, 'received', p_quantity);
end;
$function$;

grant execute on function public.receive_pharmacy_stock(uuid,uuid,text,integer,date,numeric,uuid,text) to service_role;
grant select, insert, update, delete on public.pharmacy_product_batches to anon, authenticated, service_role;
grant select, insert, update, delete on public.department_tasks to anon, authenticated, service_role;
notify pgrst, 'reload schema';
-- Round 3: encounter cols + POS sale path + hospital billing for pharmacy integration

alter table public.encounters add column if not exists clinician_id uuid references public.profiles(id);
alter table public.encounters add column if not exists visit_date timestamptz default now();

-- POS sales (no FK to cashier sessions / carts — those tables may be absent on disposable)
create table if not exists public.pharmacy_pos_sales (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  session_id uuid,
  cart_id uuid,
  cashier_id uuid not null references public.profiles(id),
  patient_id uuid references public.patients(id),
  prescription_id uuid,
  receipt_number text unique,
  subtotal numeric(12,2) not null default 0,
  discount_total numeric(12,2) not null default 0,
  tax_amount numeric(12,2) not null default 0,
  total_amount numeric(12,2) not null default 0,
  payment_method text not null default 'cash',
  payment_ref text,
  status text not null default 'pending',
  confirmed_by uuid references public.profiles(id),
  confirmed_at timestamptz,
  voided_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pharmacy_pos_sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.pharmacy_pos_sales(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  product_id uuid not null references public.pharmacy_products(id),
  batch_id uuid references public.pharmacy_product_batches(id),
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null,
  discount_amount numeric(12,2) not null default 0,
  line_total numeric(12,2) generated always as (quantity * unit_price - discount_amount) stored,
  stock_decremented boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.pharmacy_sale_idempotency (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  idempotency_key text not null,
  sale_id uuid,
  response_payload jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint pharmacy_sale_idempotency_tenant_key unique (tenant_id, idempotency_key)
);

create or replace function public.complete_pharmacy_sale(
  p_tenant_id uuid,
  p_cashier_id uuid,
  p_items jsonb,
  p_payment_method text,
  p_session_id uuid default null::uuid,
  p_cart_id uuid default null::uuid,
  p_payment_ref text default null::text,
  p_discount_total numeric default 0,
  p_tax_amount numeric default 0,
  p_patient_id uuid default null::uuid,
  p_confirmed_by uuid default null::uuid,
  p_idempotency_key text default null::text
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

create table if not exists public.billing_invoices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  patient_id uuid references public.patients(id),
  encounter_id uuid references public.encounters(id),
  status text not null default 'draft',
  currency text not null default 'UGX',
  total_amount numeric(12,2) not null default 0,
  paid_amount numeric(12,2) not null default 0,
  invoice_number text,
  notes text,
  created_by uuid,
  is_deleted boolean default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.billing_line_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  invoice_id uuid not null references public.billing_invoices(id) on delete cascade,
  item_name text not null,
  unit_price numeric(12,2) not null,
  qty numeric(12,2) not null default 1,
  total_price numeric(12,2),
  notes text,
  created_by uuid,
  is_deleted boolean default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz default now()
);

create table if not exists public.billing_payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  invoice_id uuid not null references public.billing_invoices(id) on delete cascade,
  encounter_id uuid references public.encounters(id) on delete set null,
  patient_id uuid references public.patients(id) on delete set null,
  amount numeric(12,2) not null check (amount > 0),
  currency text not null default 'UGX',
  payment_method text not null,
  payment_ref text,
  receipt_number text,
  idempotency_key text,
  received_by uuid,
  notes text,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_billing_payments_idempotency
  on public.billing_payments (tenant_id, idempotency_key)
  where idempotency_key is not null;

grant execute on function public.complete_pharmacy_sale(uuid,uuid,jsonb,text,uuid,uuid,text,numeric,numeric,uuid,uuid,text) to service_role, anon, authenticated;
grant select, insert, update, delete on public.pharmacy_pos_sales to anon, authenticated, service_role;
grant select, insert, update, delete on public.pharmacy_pos_sale_items to anon, authenticated, service_role;
grant select, insert, update, delete on public.pharmacy_sale_idempotency to anon, authenticated, service_role;
grant select, insert, update, delete on public.billing_invoices to anon, authenticated, service_role;
grant select, insert, update, delete on public.billing_line_items to anon, authenticated, service_role;
grant select, insert, update, delete on public.billing_payments to anon, authenticated, service_role;
notify pgrst, 'reload schema';

create table if not exists public.synapse_domain_events (
  event_id uuid primary key default gen_random_uuid(),
  event_type text not null,
  version text not null default '1.0.0',
  tenant_id uuid not null references public.tenants(id),
  facility_id uuid,
  actor_id uuid,
  patient_id uuid,
  person_id uuid,
  encounter_id uuid,
  occurred_at timestamptz not null default now(),
  correlation_id uuid not null,
  causation_id uuid,
  payload jsonb not null default '{}'::jsonb,
  source text not null,
  idempotency_key text not null,
  is_synthetic boolean not null default false,
  simulation_run_id uuid,
  status text not null default 'pending'
    check (status in ('pending','published','failed','dead')),
  retry_count integer not null default 0,
  last_error text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (idempotency_key)
);
create index if not exists synapse_domain_events_correlation_idx
  on public.synapse_domain_events (correlation_id, occurred_at);
grant select, insert, update, delete on public.synapse_domain_events to anon, authenticated, service_role;
notify pgrst, 'reload schema';
