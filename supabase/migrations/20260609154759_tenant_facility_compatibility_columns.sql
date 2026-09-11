-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260609154759  name: tenant_facility_compatibility_columns
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.

alter table public.tenants add column if not exists address text;
alter table public.tenants add column if not exists bed_capacity integer;
alter table public.tenants add column if not exists plan text default 'trial';
alter table public.tenants add column if not exists is_active boolean default true;
alter table public.tenants add column if not exists onboarding_completed boolean default false;
alter table public.tenants add column if not exists onboarding_step integer default 1;
alter table public.tenants add column if not exists facility_type text default 'clinic';
alter table public.tenants add column if not exists email text;
alter table public.tenants add column if not exists phone text;
alter table public.tenants add column if not exists district text;
alter table public.tenants add column if not exists custom_domain text;
alter table public.tenants add column if not exists country text default 'UG';
alter table public.tenants add column if not exists updated_at timestamptz default now();
