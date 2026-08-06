-- =============================================================================
-- Additive receipt-identity columns on pharmacy_settings.
--
-- The shared receipt engine (packages/db/src/receipt.ts + apps/web receipt BFF)
-- already reads these optional fields; this makes them first-class so the native
-- Settings screen can persist a pharmacy's legal identity for compliant receipts.
--
-- ADDITIVE + REVERSIBLE. No existing column/table is dropped or recreated.
-- Rollback: drop the columns added below (safe; they are nullable).
-- =============================================================================

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
