-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260612231111  name: pharmacy_pos_tables
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.


-- Phase 5: Pharmacy POS tables — additive only
-- NOTE: pharmacy_stock_adjustments already exists — do NOT recreate

-- ── Cashier sessions ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pharmacy_cashier_sessions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  store_id    uuid REFERENCES pharmacy_stores(id),
  cashier_id  uuid NOT NULL REFERENCES profiles(id),
  status      text NOT NULL DEFAULT 'open',  -- open | closed
  opened_at   timestamptz NOT NULL DEFAULT now(),
  closed_at   timestamptz,
  opening_float numeric(12,2) NOT NULL DEFAULT 0,
  closing_float numeric(12,2),
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pharmacy_cashier_sessions_tenant_idx ON pharmacy_cashier_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS pharmacy_cashier_sessions_cashier_idx ON pharmacy_cashier_sessions(cashier_id);
CREATE INDEX IF NOT EXISTS pharmacy_cashier_sessions_status_idx ON pharmacy_cashier_sessions(status);

-- ── Carts ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pharmacy_carts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  session_id      uuid REFERENCES pharmacy_cashier_sessions(id),
  cashier_id      uuid NOT NULL REFERENCES profiles(id),
  prescription_id uuid,  -- optional FK to prescriptions if dispensing
  status          text NOT NULL DEFAULT 'active',  -- active | checked_out | abandoned
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pharmacy_carts_tenant_idx ON pharmacy_carts(tenant_id);
CREATE INDEX IF NOT EXISTS pharmacy_carts_cashier_idx ON pharmacy_carts(cashier_id);

-- ── Cart items ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pharmacy_cart_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id         uuid NOT NULL REFERENCES pharmacy_carts(id) ON DELETE CASCADE,
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_id      uuid NOT NULL REFERENCES pharmacy_products(id),
  batch_id        uuid REFERENCES pharmacy_product_batches(id),  -- FEFO-selected batch
  quantity        integer NOT NULL CHECK (quantity > 0),
  unit_price      numeric(12,2) NOT NULL,
  discount_amount numeric(12,2) NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pharmacy_cart_items_cart_idx ON pharmacy_cart_items(cart_id);
CREATE INDEX IF NOT EXISTS pharmacy_cart_items_tenant_idx ON pharmacy_cart_items(tenant_id);

-- ── POS Sales ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pharmacy_pos_sales (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  session_id      uuid REFERENCES pharmacy_cashier_sessions(id),
  cart_id         uuid REFERENCES pharmacy_carts(id),
  cashier_id      uuid NOT NULL REFERENCES profiles(id),
  patient_id      uuid REFERENCES patients(id),
  prescription_id uuid,
  receipt_number  text UNIQUE,
  subtotal        numeric(12,2) NOT NULL,
  discount_total  numeric(12,2) NOT NULL DEFAULT 0,
  tax_amount      numeric(12,2) NOT NULL DEFAULT 0,
  total_amount    numeric(12,2) NOT NULL,
  payment_method  text NOT NULL DEFAULT 'cash',  -- cash | mobile_money | card | insurance
  payment_ref     text,
  status          text NOT NULL DEFAULT 'completed',  -- completed | voided | refunded
  confirmed_by    uuid REFERENCES profiles(id),  -- human confirmation required
  confirmed_at    timestamptz,
  voided_reason   text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pos_sales_confirmed_required CHECK (
    status != 'completed' OR (confirmed_by IS NOT NULL AND confirmed_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS pharmacy_pos_sales_tenant_idx   ON pharmacy_pos_sales(tenant_id);
CREATE INDEX IF NOT EXISTS pharmacy_pos_sales_cashier_idx  ON pharmacy_pos_sales(cashier_id);
CREATE INDEX IF NOT EXISTS pharmacy_pos_sales_session_idx  ON pharmacy_pos_sales(session_id);
CREATE INDEX IF NOT EXISTS pharmacy_pos_sales_created_idx  ON pharmacy_pos_sales(created_at DESC);

-- ── POS Sale items ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pharmacy_pos_sale_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id         uuid NOT NULL REFERENCES pharmacy_pos_sales(id) ON DELETE CASCADE,
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_id      uuid NOT NULL REFERENCES pharmacy_products(id),
  batch_id        uuid REFERENCES pharmacy_product_batches(id),
  quantity        integer NOT NULL CHECK (quantity > 0),
  unit_price      numeric(12,2) NOT NULL,
  discount_amount numeric(12,2) NOT NULL DEFAULT 0,
  line_total      numeric(12,2) GENERATED ALWAYS AS (quantity * unit_price - discount_amount) STORED,
  stock_decremented boolean NOT NULL DEFAULT false,  -- set true ONLY after confirmed sale
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pharmacy_pos_sale_items_sale_idx   ON pharmacy_pos_sale_items(sale_id);
CREATE INDEX IF NOT EXISTS pharmacy_pos_sale_items_tenant_idx ON pharmacy_pos_sale_items(tenant_id);

-- ── Refunds ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pharmacy_refunds (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sale_id         uuid NOT NULL REFERENCES pharmacy_pos_sales(id),
  cashier_id      uuid NOT NULL REFERENCES profiles(id),
  approved_by     uuid NOT NULL REFERENCES profiles(id),  -- manager approval required
  reason          text NOT NULL,
  refund_amount   numeric(12,2) NOT NULL,
  refund_method   text NOT NULL DEFAULT 'cash',
  status          text NOT NULL DEFAULT 'pending',  -- pending | approved | completed | rejected
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pharmacy_refunds_tenant_idx ON pharmacy_refunds(tenant_id);
CREATE INDEX IF NOT EXISTS pharmacy_refunds_sale_idx   ON pharmacy_refunds(sale_id);

-- ── RLS ───────────────────────────────────────────────────────────────────

ALTER TABLE pharmacy_cashier_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacy_carts            ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacy_cart_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacy_pos_sales        ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacy_pos_sale_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacy_refunds          ENABLE ROW LEVEL SECURITY;

-- Tenant isolation: profiles match same tenant_id
CREATE POLICY pharmacy_cashier_sessions_tenant ON pharmacy_cashier_sessions
  USING (same_tenant(tenant_id)) WITH CHECK (same_tenant(tenant_id));

CREATE POLICY pharmacy_carts_tenant ON pharmacy_carts
  USING (same_tenant(tenant_id)) WITH CHECK (same_tenant(tenant_id));

CREATE POLICY pharmacy_cart_items_tenant ON pharmacy_cart_items
  USING (same_tenant(tenant_id)) WITH CHECK (same_tenant(tenant_id));

CREATE POLICY pharmacy_pos_sales_tenant ON pharmacy_pos_sales
  USING (same_tenant(tenant_id)) WITH CHECK (same_tenant(tenant_id));

CREATE POLICY pharmacy_pos_sale_items_tenant ON pharmacy_pos_sale_items
  USING (same_tenant(tenant_id)) WITH CHECK (same_tenant(tenant_id));

CREATE POLICY pharmacy_refunds_tenant ON pharmacy_refunds
  USING (same_tenant(tenant_id)) WITH CHECK (same_tenant(tenant_id));
