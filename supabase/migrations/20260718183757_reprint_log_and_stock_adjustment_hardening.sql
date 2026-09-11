-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260718183757  name: reprint_log_and_stock_adjustment_hardening
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.

-- M5: receipt reprint audit log (service-role only: RLS enabled, no policies = deny-all)
CREATE TABLE IF NOT EXISTS pharmacy_receipt_reprints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  sale_id uuid NOT NULL REFERENCES pharmacy_pos_sales(id),
  reprinted_by uuid,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE pharmacy_receipt_reprints ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_receipt_reprints_sale ON pharmacy_receipt_reprints(sale_id);
CREATE INDEX IF NOT EXISTS idx_receipt_reprints_tenant_time ON pharmacy_receipt_reprints(tenant_id, created_at);

-- M6: stock adjustments gain batch linkage + approver
ALTER TABLE pharmacy_stock_adjustments
  ADD COLUMN IF NOT EXISTS batch_id uuid REFERENCES pharmacy_product_batches(id),
  ADD COLUMN IF NOT EXISTS approved_by uuid;
