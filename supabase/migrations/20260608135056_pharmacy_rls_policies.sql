-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260608135056  name: pharmacy_rls_policies
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.


-- ============================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE pharmacy_settings           ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacy_user_settings      ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacy_suppliers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacy_products           ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacy_product_packages   ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacy_product_batches    ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacy_stock_adjustments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacy_customers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacy_clients            ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacy_transactions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacy_transaction_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacy_transaction_edits  ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacy_purchase_orders    ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacy_purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacy_orders             ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacy_order_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacy_audit_logs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacy_notifications      ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacy_inquiries          ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES — Tenant isolation via profiles.tenant_id
-- ============================================================

-- Helper: check if current user is a platform admin
-- Pattern: staff see only their tenant; platform_admin sees all

CREATE POLICY "pharmacy_settings_tenant_isolation" ON pharmacy_settings
  FOR ALL USING (
    tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid() LIMIT 1)
    OR (SELECT is_admin FROM profiles WHERE id = auth.uid() LIMIT 1) = true
  );

CREATE POLICY "pharmacy_user_settings_tenant_isolation" ON pharmacy_user_settings
  FOR ALL USING (
    tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid() LIMIT 1)
    OR (SELECT is_admin FROM profiles WHERE id = auth.uid() LIMIT 1) = true
  );

CREATE POLICY "pharmacy_suppliers_tenant_isolation" ON pharmacy_suppliers
  FOR ALL USING (
    tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid() LIMIT 1)
    OR (SELECT is_admin FROM profiles WHERE id = auth.uid() LIMIT 1) = true
  );

CREATE POLICY "pharmacy_products_tenant_isolation" ON pharmacy_products
  FOR ALL USING (
    tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid() LIMIT 1)
    OR (SELECT is_admin FROM profiles WHERE id = auth.uid() LIMIT 1) = true
  );

CREATE POLICY "pharmacy_product_packages_tenant_isolation" ON pharmacy_product_packages
  FOR ALL USING (
    tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid() LIMIT 1)
    OR (SELECT is_admin FROM profiles WHERE id = auth.uid() LIMIT 1) = true
  );

CREATE POLICY "pharmacy_product_batches_tenant_isolation" ON pharmacy_product_batches
  FOR ALL USING (
    tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid() LIMIT 1)
    OR (SELECT is_admin FROM profiles WHERE id = auth.uid() LIMIT 1) = true
  );

CREATE POLICY "pharmacy_stock_adjustments_tenant_isolation" ON pharmacy_stock_adjustments
  FOR ALL USING (
    tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid() LIMIT 1)
    OR (SELECT is_admin FROM profiles WHERE id = auth.uid() LIMIT 1) = true
  );

CREATE POLICY "pharmacy_customers_tenant_isolation" ON pharmacy_customers
  FOR ALL USING (
    tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid() LIMIT 1)
    OR (SELECT is_admin FROM profiles WHERE id = auth.uid() LIMIT 1) = true
  );

CREATE POLICY "pharmacy_clients_tenant_isolation" ON pharmacy_clients
  FOR ALL USING (
    tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid() LIMIT 1)
    OR (SELECT is_admin FROM profiles WHERE id = auth.uid() LIMIT 1) = true
  );

CREATE POLICY "pharmacy_transactions_tenant_isolation" ON pharmacy_transactions
  FOR ALL USING (
    tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid() LIMIT 1)
    OR (SELECT is_admin FROM profiles WHERE id = auth.uid() LIMIT 1) = true
  );

CREATE POLICY "pharmacy_transaction_items_tenant_isolation" ON pharmacy_transaction_items
  FOR ALL USING (
    tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid() LIMIT 1)
    OR (SELECT is_admin FROM profiles WHERE id = auth.uid() LIMIT 1) = true
  );

CREATE POLICY "pharmacy_transaction_edits_tenant_isolation" ON pharmacy_transaction_edits
  FOR ALL USING (
    tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid() LIMIT 1)
    OR (SELECT is_admin FROM profiles WHERE id = auth.uid() LIMIT 1) = true
  );

CREATE POLICY "pharmacy_purchase_orders_tenant_isolation" ON pharmacy_purchase_orders
  FOR ALL USING (
    tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid() LIMIT 1)
    OR (SELECT is_admin FROM profiles WHERE id = auth.uid() LIMIT 1) = true
  );

CREATE POLICY "pharmacy_purchase_order_items_tenant_isolation" ON pharmacy_purchase_order_items
  FOR ALL USING (
    tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid() LIMIT 1)
    OR (SELECT is_admin FROM profiles WHERE id = auth.uid() LIMIT 1) = true
  );

CREATE POLICY "pharmacy_orders_tenant_isolation" ON pharmacy_orders
  FOR ALL USING (
    tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid() LIMIT 1)
    OR (SELECT is_admin FROM profiles WHERE id = auth.uid() LIMIT 1) = true
  );

CREATE POLICY "pharmacy_order_items_tenant_isolation" ON pharmacy_order_items
  FOR ALL USING (
    tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid() LIMIT 1)
    OR (SELECT is_admin FROM profiles WHERE id = auth.uid() LIMIT 1) = true
  );

CREATE POLICY "pharmacy_audit_logs_tenant_isolation" ON pharmacy_audit_logs
  FOR ALL USING (
    tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid() LIMIT 1)
    OR (SELECT is_admin FROM profiles WHERE id = auth.uid() LIMIT 1) = true
  );

CREATE POLICY "pharmacy_notifications_own_or_admin" ON pharmacy_notifications
  FOR ALL USING (
    profile_id = auth.uid()
    OR tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid() LIMIT 1)
    OR (SELECT is_admin FROM profiles WHERE id = auth.uid() LIMIT 1) = true
  );

CREATE POLICY "pharmacy_inquiries_tenant_isolation" ON pharmacy_inquiries
  FOR ALL USING (
    tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid() LIMIT 1)
    OR (SELECT is_admin FROM profiles WHERE id = auth.uid() LIMIT 1) = true
  );

-- ============================================================
-- UPDATED_AT TRIGGER FUNCTION (shared utility)
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to all tables that have the column
CREATE TRIGGER set_pharmacy_settings_updated_at
  BEFORE UPDATE ON pharmacy_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_pharmacy_user_settings_updated_at
  BEFORE UPDATE ON pharmacy_user_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_pharmacy_suppliers_updated_at
  BEFORE UPDATE ON pharmacy_suppliers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_pharmacy_products_updated_at
  BEFORE UPDATE ON pharmacy_products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_pharmacy_product_packages_updated_at
  BEFORE UPDATE ON pharmacy_product_packages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_pharmacy_product_batches_updated_at
  BEFORE UPDATE ON pharmacy_product_batches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_pharmacy_customers_updated_at
  BEFORE UPDATE ON pharmacy_customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_pharmacy_clients_updated_at
  BEFORE UPDATE ON pharmacy_clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_pharmacy_transactions_updated_at
  BEFORE UPDATE ON pharmacy_transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_pharmacy_purchase_orders_updated_at
  BEFORE UPDATE ON pharmacy_purchase_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_pharmacy_orders_updated_at
  BEFORE UPDATE ON pharmacy_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_pharmacy_inquiries_updated_at
  BEFORE UPDATE ON pharmacy_inquiries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
