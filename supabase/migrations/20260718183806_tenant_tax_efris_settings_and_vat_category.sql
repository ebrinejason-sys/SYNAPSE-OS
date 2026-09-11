-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260718183806  name: tenant_tax_efris_settings_and_vat_category
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.

-- M7: opt-in VAT/EFRIS + POS policy settings on existing pharmacy_settings
ALTER TABLE pharmacy_settings
  ADD COLUMN IF NOT EXISTS vat_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS vat_rate numeric NOT NULL DEFAULT 18,
  ADD COLUMN IF NOT EXISTS efris_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS efris_tin text,
  ADD COLUMN IF NOT EXISTS efris_device_no text,
  ADD COLUMN IF NOT EXISTS discount_approval_threshold_pct numeric NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS mandatory_receipt_print boolean NOT NULL DEFAULT true;

-- per-product VAT category (Uganda: most essential medicines are exempt)
ALTER TABLE pharmacy_products
  ADD COLUMN IF NOT EXISTS vat_category text NOT NULL DEFAULT 'exempt';
ALTER TABLE pharmacy_products
  ADD CONSTRAINT chk_vat_category CHECK (vat_category IN ('standard','exempt','zero_rated'));
