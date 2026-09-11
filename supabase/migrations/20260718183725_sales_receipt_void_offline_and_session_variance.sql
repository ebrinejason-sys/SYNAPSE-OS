-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260718183725  name: sales_receipt_void_offline_and_session_variance
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.

-- M3: receipt persistence, void audit, offline-first columns on sales
ALTER TABLE pharmacy_pos_sales
  ADD COLUMN IF NOT EXISTS receipt_pdf_path text,
  ADD COLUMN IF NOT EXISTS printed_at timestamptz,
  ADD COLUMN IF NOT EXISTS print_failed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS voided_by uuid,
  ADD COLUMN IF NOT EXISTS voided_at timestamptz,
  ADD COLUMN IF NOT EXISTS terminal_code text,
  ADD COLUMN IF NOT EXISTS is_offline_sale boolean NOT NULL DEFAULT false;

-- M9: blind-count cash reconciliation on cashier sessions
ALTER TABLE pharmacy_cashier_sessions
  ADD COLUMN IF NOT EXISTS expected_cash numeric,
  ADD COLUMN IF NOT EXISTS counted_cash numeric,
  ADD COLUMN IF NOT EXISTS cash_variance numeric,
  ADD COLUMN IF NOT EXISTS closed_by uuid;
