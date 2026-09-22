-- Pharmacy purchases: actual financial/receipt events distinct from purchase orders.
-- Inventory still enters only via receive_pharmacy_stock.
-- Walk-in purchases do not require a prior PO.

alter table public.pharmacy_suppliers
  add column if not exists tax_number text;

alter table public.pharmacy_products
  add column if not exists expiry_required boolean not null default true;

alter table public.pharmacy_purchase_order_items
  add column if not exists received_quantity integer not null default 0;

alter table public.pharmacy_purchase_orders
  drop constraint if exists pharmacy_purchase_orders_status_check;

alter table public.pharmacy_purchase_orders
  add constraint pharmacy_purchase_orders_status_check
  check (status = any (array[
    'DRAFT'::text,
    'SENT'::text,
    'CONFIRMED'::text,
    'SHIPPED'::text,
    'PARTIALLY_RECEIVED'::text,
    'RECEIVED'::text,
    'CANCELLED'::text
  ]));

create table if not exists public.pharmacy_purchases (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  purchase_no text not null,
  supplier_id uuid not null references public.pharmacy_suppliers(id),
  purchase_order_id uuid references public.pharmacy_purchase_orders(id) on delete set null,
  store_id uuid,
  supplier_invoice_no text,
  supplier_receipt_ref text,
  purchase_date date not null default ((timezone('Africa/Kampala', now()))::date),
  received_date date,
  payment_status text not null default 'UNPAID'
    check (payment_status = any (array['UNPAID'::text, 'PARTIAL'::text, 'PAID'::text, 'CREDIT'::text])),
  payment_method text,
  currency text not null default 'UGX',
  subtotal numeric not null default 0,
  tax numeric not null default 0,
  discount numeric not null default 0,
  other_cost numeric not null default 0,
  total numeric not null default 0,
  amount_paid numeric not null default 0,
  balance numeric not null default 0,
  notes text,
  status text not null default 'DRAFT'
    check (status = any (array['DRAFT'::text, 'RECEIVED'::text, 'PARTIALLY_RECEIVED'::text, 'CANCELLED'::text])),
  created_by uuid references public.profiles(id),
  received_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, purchase_no)
);

create index if not exists idx_pharm_purchases_tenant on public.pharmacy_purchases (tenant_id, created_at desc);
create index if not exists idx_pharm_purchases_supplier on public.pharmacy_purchases (supplier_id);
create index if not exists idx_pharm_purchases_status on public.pharmacy_purchases (tenant_id, status);
create index if not exists idx_pharm_purchases_payment on public.pharmacy_purchases (tenant_id, payment_status);
create index if not exists idx_pharm_purchases_po on public.pharmacy_purchases (purchase_order_id);

create table if not exists public.pharmacy_purchase_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  purchase_id uuid not null references public.pharmacy_purchases(id) on delete cascade,
  purchase_order_item_id uuid references public.pharmacy_purchase_order_items(id) on delete set null,
  product_id uuid references public.pharmacy_products(id),
  product_name text not null,
  quantity integer not null check (quantity > 0),
  received_quantity integer not null default 0,
  purchase_unit text,
  unit_cost numeric not null default 0,
  line_total numeric not null default 0,
  batch_number text,
  expiry_date date,
  manufacture_date date,
  batch_id uuid references public.pharmacy_product_batches(id),
  selling_price numeric,
  supplier_product_ref text,
  receipt_idempotency_key text,
  created_at timestamptz not null default now()
);

create unique index if not exists pharmacy_purchase_items_receipt_key_uidx
  on public.pharmacy_purchase_items (tenant_id, receipt_idempotency_key)
  where receipt_idempotency_key is not null;

create index if not exists idx_pharm_purchase_items_purchase on public.pharmacy_purchase_items (purchase_id);
create index if not exists idx_pharm_purchase_items_product on public.pharmacy_purchase_items (product_id);

create table if not exists public.pharmacy_purchase_idempotency (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  idempotency_key text not null,
  purchase_id uuid references public.pharmacy_purchases(id) on delete cascade,
  response jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (tenant_id, idempotency_key)
);

create table if not exists public.pharmacy_purchase_attachments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  purchase_id uuid not null references public.pharmacy_purchases(id) on delete cascade,
  kind text not null check (kind = any (array['invoice'::text, 'receipt'::text, 'delivery_note'::text])),
  filename text not null,
  content_type text,
  storage_path text not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_pharm_purchase_attachments_purchase
  on public.pharmacy_purchase_attachments (purchase_id);

create table if not exists public.pharmacy_supplier_returns (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  purchase_id uuid references public.pharmacy_purchases(id) on delete set null,
  supplier_id uuid not null references public.pharmacy_suppliers(id),
  reason text,
  credit_ref text,
  status text not null default 'DRAFT'
    check (status = any (array['DRAFT'::text, 'COMPLETED'::text, 'CANCELLED'::text])),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.pharmacy_purchases is
  'Actual supplier purchase/receipt. Distinct from pharmacy_purchase_orders (planned order). Stock enters via receive_pharmacy_stock.';
comment on table public.pharmacy_purchase_items is
  'Purchase lines with actual batch/cost. received_quantity is filled only after canonical inventory receipt.';
comment on table public.pharmacy_supplier_returns is
  'Lifecycle stub for later supplier returns. Stock decrease must use adjust_pharmacy_batch_stock, never product.quantity.';

do $$
declare
  t text;
  tables text[] := array[
    'pharmacy_purchases',
    'pharmacy_purchase_items',
    'pharmacy_purchase_idempotency',
    'pharmacy_purchase_attachments',
    'pharmacy_supplier_returns'
  ];
begin
  foreach t in array tables loop
    execute format('alter table public.%I enable row level security', t);
    if not exists (
      select 1 from pg_policies where schemaname = 'public' and tablename = t
        and policyname = t || '_tenant_isolation'
    ) then
      execute format(
        'create policy %I on public.%I for all using (tenant_id = current_tenant_id() or is_platform_admin()) with check (tenant_id = current_tenant_id() or is_platform_admin())',
        t || '_tenant_isolation', t
      );
    end if;
    execute format('grant select, insert, update, delete on public.%I to service_role', t);
    execute format('revoke all on public.%I from public, anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to service_role', t);
  end loop;
end $$;
