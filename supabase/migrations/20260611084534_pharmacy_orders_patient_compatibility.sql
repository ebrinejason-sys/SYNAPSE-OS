-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260611084534  name: pharmacy_orders_patient_compatibility
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.

alter table public.pharmacy_orders add column if not exists patient_id uuid references public.profiles(id);
alter table public.pharmacy_orders add column if not exists tenant_id uuid references public.tenants(id) on delete cascade;
alter table public.pharmacy_orders add column if not exists items jsonb not null default '[]';
alter table public.pharmacy_orders add column if not exists total_ugx integer not null default 0;
alter table public.pharmacy_orders add column if not exists fulfillment_type text;
alter table public.pharmacy_orders add column if not exists payment_status text not null default 'unpaid';
alter table public.pharmacy_orders add column if not exists payment_ref text;
