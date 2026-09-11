-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260718183718  name: nda_batch_manufacturer_and_sale_item_audit
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.

-- M1: manufacturer + supplier ref at BATCH level (NDA traceability)
ALTER TABLE pharmacy_product_batches
  ADD COLUMN IF NOT EXISTS manufacturer text,
  ADD COLUMN IF NOT EXISTS supplier_invoice_ref text;

-- backfill batch manufacturer from product-level fallback
UPDATE pharmacy_product_batches b
SET manufacturer = p.manufacturer
FROM pharmacy_products p
WHERE b.product_id = p.id AND b.manufacturer IS NULL AND p.manufacturer IS NOT NULL;

-- M2: price-integrity + batch snapshot columns on sale lines
ALTER TABLE pharmacy_pos_sale_items
  ADD COLUMN IF NOT EXISTS list_price numeric,
  ADD COLUMN IF NOT EXISTS discount_reason text,
  ADD COLUMN IF NOT EXISTS discount_approved_by uuid,
  ADD COLUMN IF NOT EXISTS batch_number_snapshot text,
  ADD COLUMN IF NOT EXISTS batch_expiry_snapshot date,
  ADD COLUMN IF NOT EXISTS batch_manufacturer_snapshot text;

-- any discount must carry a reason (table currently empty; safe to validate)
ALTER TABLE pharmacy_pos_sale_items
  ADD CONSTRAINT chk_discount_requires_reason
  CHECK (discount_amount IS NULL OR discount_amount = 0 OR discount_reason IS NOT NULL);
