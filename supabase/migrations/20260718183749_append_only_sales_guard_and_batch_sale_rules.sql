-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260718183749  name: append_only_sales_guard_and_batch_sale_rules
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.

-- M4a: append-only guard on completed/voided sales
CREATE OR REPLACE FUNCTION guard_pos_sale_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status IN ('completed','voided') THEN
      RAISE EXCEPTION 'APPEND_ONLY: completed/voided sales cannot be deleted (sale %)', OLD.receipt_number;
    END IF;
    RETURN OLD;
  END IF;

  -- UPDATE path
  IF OLD.status = 'voided' THEN
    RAISE EXCEPTION 'APPEND_ONLY: voided sales are immutable (sale %)', OLD.receipt_number;
  END IF;

  IF OLD.status = 'completed' THEN
    -- financial identity must never change
    IF NEW.subtotal        IS DISTINCT FROM OLD.subtotal
    OR NEW.discount_total  IS DISTINCT FROM OLD.discount_total
    OR NEW.tax_amount      IS DISTINCT FROM OLD.tax_amount
    OR NEW.total_amount    IS DISTINCT FROM OLD.total_amount
    OR NEW.payment_method  IS DISTINCT FROM OLD.payment_method
    OR NEW.payment_ref     IS DISTINCT FROM OLD.payment_ref
    OR NEW.receipt_number  IS DISTINCT FROM OLD.receipt_number
    OR NEW.tenant_id       IS DISTINCT FROM OLD.tenant_id
    OR NEW.cashier_id      IS DISTINCT FROM OLD.cashier_id
    OR NEW.session_id      IS DISTINCT FROM OLD.session_id
    OR NEW.created_at      IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'APPEND_ONLY: financial fields of a completed sale are immutable (sale %)', OLD.receipt_number;
    END IF;
    -- allowed transitions: receipt artifact updates, or a properly documented void
    IF NEW.status = 'voided' THEN
      IF NEW.voided_reason IS NULL OR NEW.voided_by IS NULL THEN
        RAISE EXCEPTION 'VOID_REQUIRES_AUDIT: voided_reason and voided_by are mandatory (sale %)', OLD.receipt_number;
      END IF;
      NEW.voided_at := COALESCE(NEW.voided_at, now());
    ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'APPEND_ONLY: completed sales can only transition to voided (sale %)', OLD.receipt_number;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_guard_pos_sale_mutation ON pharmacy_pos_sales;
CREATE TRIGGER trg_guard_pos_sale_mutation
  BEFORE UPDATE OR DELETE ON pharmacy_pos_sales
  FOR EACH ROW EXECUTE FUNCTION guard_pos_sale_mutation();

-- M4b: sale line items of completed/voided sales are fully immutable
CREATE OR REPLACE FUNCTION guard_pos_sale_item_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_status text;
BEGIN
  SELECT status INTO v_status FROM pharmacy_pos_sales WHERE id = COALESCE(OLD.sale_id, NEW.sale_id);
  IF v_status IN ('completed','voided') THEN
    RAISE EXCEPTION 'APPEND_ONLY: line items of a % sale are immutable', v_status;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_guard_pos_sale_item_mutation ON pharmacy_pos_sale_items;
CREATE TRIGGER trg_guard_pos_sale_item_mutation
  BEFORE UPDATE OR DELETE ON pharmacy_pos_sale_items
  FOR EACH ROW EXECUTE FUNCTION guard_pos_sale_item_mutation();

-- M8: on insert of a sale line — block expired batches (Kampala date) and auto-fill NDA snapshots + list_price
CREATE OR REPLACE FUNCTION pos_sale_item_before_insert() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_batch pharmacy_product_batches%ROWTYPE;
  v_prod_manufacturer text;
  v_prod_price numeric;
BEGIN
  SELECT manufacturer, price INTO v_prod_manufacturer, v_prod_price
  FROM pharmacy_products WHERE id = NEW.product_id;

  IF NEW.batch_id IS NOT NULL THEN
    SELECT * INTO v_batch FROM pharmacy_product_batches WHERE id = NEW.batch_id;
    IF FOUND THEN
      IF v_batch.expiry_date IS NOT NULL
         AND v_batch.expiry_date < (now() AT TIME ZONE 'Africa/Kampala')::date THEN
        RAISE EXCEPTION 'EXPIRED_BATCH_BLOCKED: batch % expired % — cannot be sold', v_batch.batch_number, v_batch.expiry_date;
      END IF;
      NEW.batch_number_snapshot       := COALESCE(NEW.batch_number_snapshot, v_batch.batch_number);
      NEW.batch_expiry_snapshot       := COALESCE(NEW.batch_expiry_snapshot, v_batch.expiry_date);
      NEW.batch_manufacturer_snapshot := COALESCE(NEW.batch_manufacturer_snapshot, v_batch.manufacturer, v_prod_manufacturer);
    END IF;
  ELSE
    NEW.batch_manufacturer_snapshot := COALESCE(NEW.batch_manufacturer_snapshot, v_prod_manufacturer);
  END IF;

  NEW.list_price := COALESCE(NEW.list_price, v_prod_price, NEW.unit_price);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_pos_sale_item_before_insert ON pharmacy_pos_sale_items;
CREATE TRIGGER trg_pos_sale_item_before_insert
  BEFORE INSERT ON pharmacy_pos_sale_items
  FOR EACH ROW EXECUTE FUNCTION pos_sale_item_before_insert();
