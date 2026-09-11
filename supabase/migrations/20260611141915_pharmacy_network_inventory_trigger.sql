-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260611141915  name: pharmacy_network_inventory_trigger
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.


-- Migration 1e: Auto-sync network inventory trigger
-- Adapted to actual column names: pharmacy_tenant_id, quantity_in_stock, is_available

CREATE OR REPLACE FUNCTION fn_sync_network_inventory()
RETURNS TRIGGER AS $$
DECLARE
  v_is_network BOOLEAN;
BEGIN
  -- Check if this tenant is a network member
  SELECT is_network_member INTO v_is_network
  FROM tenants WHERE id = COALESCE(NEW.tenant_id, OLD.tenant_id);
  
  IF v_is_network THEN
    INSERT INTO pharmacy_network_inventory 
      (pharmacy_tenant_id, drug_name, generic_name, dosage_form, strength,
       quantity_in_stock, unit_price_ugx, is_available, last_synced_at)
    VALUES (
      COALESCE(NEW.tenant_id, OLD.tenant_id),
      lower(trim(COALESCE(NEW.name, 'Unknown'))),
      COALESCE(NEW.generic_name, NEW.name, 'Unknown'),
      COALESCE(NEW.dosage_form, 'Other'),
      COALESCE(NEW.strength, ''),
      COALESCE(NEW.quantity, 0),
      COALESCE(NEW.price, 0),
      COALESCE(NEW.quantity, 0) > 0 AND COALESCE(NEW.is_active, true),
      now()
    )
    ON CONFLICT (pharmacy_tenant_id, drug_name) 
    DO UPDATE SET
      quantity_in_stock = EXCLUDED.quantity_in_stock,
      unit_price_ugx = EXCLUDED.unit_price_ugx,
      is_available = EXCLUDED.is_available,
      last_synced_at = now();
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop if exists, recreate cleanly
DROP TRIGGER IF EXISTS trg_sync_network_inventory ON pharmacy_products;
CREATE TRIGGER trg_sync_network_inventory
  AFTER INSERT OR UPDATE OF quantity, is_active OR DELETE
  ON pharmacy_products
  FOR EACH ROW EXECUTE FUNCTION fn_sync_network_inventory();

-- Unique constraint needed for upsert
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'uq_network_inv_tenant_drug'
  ) THEN
    ALTER TABLE pharmacy_network_inventory 
      ADD CONSTRAINT uq_network_inv_tenant_drug UNIQUE (pharmacy_tenant_id, drug_name);
  END IF;
END $$;
