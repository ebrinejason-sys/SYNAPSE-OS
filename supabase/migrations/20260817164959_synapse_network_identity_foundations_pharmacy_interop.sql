-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260817164959  name: synapse_network_identity_foundations_pharmacy_interop
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.

do $$
begin
  if to_regclass('public.pharmacy_product_batches') is not null then
    alter table public.pharmacy_product_batches add column if not exists store_id uuid;
  end if;
  if to_regclass('public.pharmacy_pos_sales') is not null then
    alter table public.pharmacy_pos_sales add column if not exists store_id uuid;
  end if;
  if to_regclass('public.pharmacy_stores') is not null then
    alter table public.pharmacy_stores
      add column if not exists parent_store_id uuid,
      add column if not exists address text,
      add column if not exists district text,
      add column if not exists phone text,
      add column if not exists is_warehouse boolean default false;
  end if;
end $$;

do $$
begin
  if to_regclass('public.pharmacy_product_batches') is not null then
    execute 'create index if not exists pharmacy_product_batches_store_idx on public.pharmacy_product_batches (store_id)';
  end if;
end $$;

create table if not exists public.pharmacy_stock_transfers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  from_store_id uuid not null,
  to_store_id uuid not null,
  status text not null default 'draft'
    check (status in ('draft','in_transit','received','cancelled')),
  requested_by uuid references public.profiles(id),
  received_by uuid references public.profiles(id),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  received_at timestamptz,
  constraint pharmacy_stock_transfers_distinct_stores check (from_store_id <> to_store_id)
);

create table if not exists public.pharmacy_stock_transfer_items (
  id uuid primary key default gen_random_uuid(),
  transfer_id uuid not null references public.pharmacy_stock_transfers(id) on delete cascade,
  product_id uuid not null,
  from_batch_id uuid,
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now()
);

create index if not exists pharmacy_stock_transfers_tenant_idx
  on public.pharmacy_stock_transfers (tenant_id, created_at desc);

create table if not exists public.interop_connections (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  adapter_type text not null
    check (adapter_type in (
      'fhir','hl7v2','astm','openmrs','ugandaemr','lis','rest','webhook','other'
    )),
  display_name text not null,
  endpoint_url text,
  credential_ref text,
  mapping jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  last_success_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists interop_connections_tenant_idx on public.interop_connections (tenant_id);

create table if not exists public.interop_messages (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid references public.interop_connections(id),
  tenant_id uuid not null references public.tenants(id),
  direction text not null check (direction in ('inbound','outbound')),
  protocol text not null,
  message_type text,
  external_id text,
  payload jsonb,
  raw_payload text,
  validation_status text not null default 'received'
    check (validation_status in ('received','valid','invalid','transformed','applied','rejected')),
  person_id uuid references public.persons(id),
  idempotency_key text,
  created_at timestamptz not null default now()
);

create unique index if not exists interop_messages_idempotency_uidx
  on public.interop_messages (tenant_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists interop_messages_tenant_created_idx
  on public.interop_messages (tenant_id, created_at desc);

create table if not exists public.lab_specimens (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  person_id uuid references public.persons(id),
  patient_id uuid references public.patients(id),
  encounter_id uuid,
  lab_order_id uuid,
  accession_number text not null,
  barcode text,
  specimen_type text,
  status text not null default 'collected'
    check (status in ('ordered','collected','in_lab','on_analyzer','resulted','verified','rejected','disposed')),
  collected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists lab_specimens_tenant_accession_uidx
  on public.lab_specimens (tenant_id, accession_number);

create index if not exists lab_specimens_barcode_idx on public.lab_specimens (barcode);

create table if not exists public.lab_analyzer_messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  analyzer_id text,
  protocol text not null default 'hl7'
    check (protocol in ('hl7','astm','tcp','serial','middleware','other')),
  accession_number text,
  raw_message text not null,
  parsed jsonb,
  direction text not null default 'inbound' check (direction in ('inbound','outbound')),
  created_at timestamptz not null default now()
);

create table if not exists public.offline_mutation_outbox (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  site_id uuid,
  actor_id uuid references public.profiles(id),
  mutation_type text not null,
  idempotency_key text not null,
  payload jsonb not null,
  status text not null default 'queued'
    check (status in ('queued','syncing','applied','conflict','rejected')),
  client_device_id text,
  created_at timestamptz not null default now(),
  applied_at timestamptz,
  conflict_reason text,
  unique (tenant_id, idempotency_key)
);

create index if not exists offline_mutation_outbox_status_idx
  on public.offline_mutation_outbox (tenant_id, status, created_at);

create table if not exists public.platform_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  actor_role text,
  action text not null,
  resource_type text not null,
  resource_id uuid,
  organization_id uuid,
  tenant_id uuid,
  site_id uuid,
  source text,
  device_id text,
  session_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists platform_audit_events_resource_idx
  on public.platform_audit_events (resource_type, resource_id, created_at desc);
create index if not exists platform_audit_events_tenant_idx
  on public.platform_audit_events (tenant_id, created_at desc);
