-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260611084450  name: pharmacy_domain_provisioning
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.

create table if not exists public.pharmacy_profiles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid unique references public.tenants(id) on delete cascade,
  pharmacy_name text,
  license_number text,
  license_expiry date,
  district text,
  physical_address text,
  contact_person text,
  contact_phone text,
  contact_email text,
  default_domain text,
  custom_domain text unique,
  custom_domain_verified boolean not null default false,
  custom_domain_verified_at timestamptz,
  vercel_domain_id text,
  is_network_visible boolean not null default true,
  delivery_available boolean not null default false,
  delivery_radius_km integer,
  migrated_from text,
  migration_status text not null default 'pending',
  migration_completed_at timestamptz,
  logo_url text,
  theme_color text not null default '#F97316',
  network_joined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.pharmacy_profiles
  add column if not exists domain_status text default 'default',
  add column if not exists domain_verification jsonb,
  add column if not exists domain_error text,
  add column if not exists domain_configured_at timestamptz,
  add column if not exists last_domain_check_at timestamptz,
  add column if not exists vercel_domain_id text;

create table if not exists public.pharmacy_network_inventory (
  id uuid primary key default gen_random_uuid(),
  pharmacy_tenant_id uuid references public.tenants(id) on delete cascade,
  drug_name text not null,
  generic_name text,
  brand_name text,
  dosage_form text,
  strength text,
  quantity_in_stock integer not null default 0,
  unit_price_ugx numeric(12,2),
  is_available boolean generated always as (quantity_in_stock > 0) stored,
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.drug_shortage_alerts (
  id uuid primary key default gen_random_uuid(),
  drug_name text not null,
  generic_name text,
  drug_code text,
  alert_level text not null check (alert_level in ('watch','warning','critical')),
  affected_districts text[] not null default '{}',
  pharmacy_count_affected integer not null default 0,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.pharmacy_orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  patient_id uuid references public.profiles(id),
  order_ref text unique not null default ('ORD-' || upper(substr(md5(random()::text), 1, 8))),
  items jsonb not null default '[]',
  total_ugx integer not null default 0,
  status text not null default 'pending' check (status in ('pending','confirmed','preparing','ready','dispatched','delivered','cancelled')),
  fulfillment_type text check (fulfillment_type in ('pickup','delivery')),
  prescription_id uuid,
  notes text,
  payment_status text not null default 'unpaid',
  payment_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.pharmacy_profiles enable row level security;
alter table public.pharmacy_network_inventory enable row level security;
alter table public.drug_shortage_alerts enable row level security;
alter table public.pharmacy_orders enable row level security;

create index if not exists idx_pharmacy_profiles_tenant on public.pharmacy_profiles(tenant_id);
create index if not exists idx_pharmacy_profiles_custom_domain on public.pharmacy_profiles(custom_domain);
create index if not exists idx_pharmacy_inventory_tenant_drug on public.pharmacy_network_inventory(pharmacy_tenant_id, drug_name);
create index if not exists idx_pharmacy_orders_tenant_status on public.pharmacy_orders(tenant_id, status, created_at desc);
create index if not exists idx_shortage_alerts_active_drug on public.drug_shortage_alerts(is_active, drug_name);
