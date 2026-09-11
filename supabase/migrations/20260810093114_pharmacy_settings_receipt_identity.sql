-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260810093114  name: pharmacy_settings_receipt_identity
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.

-- Additive receipt-identity columns on pharmacy_settings.
alter table if exists public.pharmacy_settings
  add column if not exists legal_name text,
  add column if not exists trading_name text,
  add column if not exists logo_url text,
  add column if not exists tin text,
  add column if not exists nda_license_number text,
  add column if not exists supervising_pharmacist text,
  add column if not exists pharmacist_registration_number text,
  add column if not exists branch_name text,
  add column if not exists vat_enabled boolean not null default false,
  add column if not exists vat_rate numeric not null default 18,
  add column if not exists discount_approval_threshold_pct numeric not null default 5,
  add column if not exists mandatory_receipt_print boolean not null default true;
