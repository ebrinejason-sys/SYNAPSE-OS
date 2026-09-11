-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260608134937  name: pharmacy_core_tables
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.


-- ============================================================
-- PHARMACY CORE TABLES
-- ============================================================

-- Per-pharmacy settings (replaces Settings model)
CREATE TABLE IF NOT EXISTS pharmacy_settings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  pharmacy_name   TEXT NOT NULL DEFAULT 'Synapse Pharmacy',
  location        TEXT,
  contact         TEXT,
  email           TEXT,
  logo            TEXT,
  footer_text     TEXT,
  receipt_header  TEXT,
  receipt_footer  TEXT,
  tax_rate        DECIMAL(5,4) NOT NULL DEFAULT 0,
  currency        TEXT NOT NULL DEFAULT 'UGX',
  low_stock_threshold INTEGER NOT NULL DEFAULT 10,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id)
);

-- Per-user pharmacy-specific settings (replaces User model's pharmacy fields)
CREATE TABLE IF NOT EXISTS pharmacy_user_settings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  profile_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  username        TEXT UNIQUE,
  pharmacy_role   TEXT NOT NULL DEFAULT 'pharmacy_staff'
    CHECK (pharmacy_role IN ('pharmacy_ceo', 'pharmacy_admin', 'pharmacy_staff')),
  permissions     TEXT[] DEFAULT '{}',
  must_change_password BOOLEAN DEFAULT false,
  two_factor_enabled   BOOLEAN DEFAULT false,
  two_factor_email     TEXT,
  is_active       BOOLEAN DEFAULT true,
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, profile_id)
);

-- Suppliers
CREATE TABLE IF NOT EXISTS pharmacy_suppliers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  email           TEXT,
  phone           TEXT,
  address         TEXT,
  contact_person  TEXT,
  notes           TEXT,
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pharm_suppliers_tenant ON pharmacy_suppliers(tenant_id);

-- Products (drugs + general stock)
CREATE TABLE IF NOT EXISTS pharmacy_products (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  category        TEXT NOT NULL DEFAULT 'General',
  sku             TEXT NOT NULL,
  barcode         TEXT,
  price           DECIMAL(14,2) NOT NULL,
  cost_price      DECIMAL(14,2) NOT NULL,
  quantity        INTEGER NOT NULL DEFAULT 0,
  reorder_level   INTEGER NOT NULL DEFAULT 10,
  unit_of_measure TEXT NOT NULL DEFAULT 'Tablet',
  expiry_date     DATE,
  manufacturer    TEXT,
  batch_number    TEXT,
  is_active       BOOLEAN DEFAULT true,
  -- Drug-specific
  strength        TEXT,
  dosage_form     TEXT,
  active_ingredient TEXT,
  generic_name    TEXT,
  side_effects    TEXT,
  storage_instructions TEXT,
  regulatory_id   TEXT,
  requires_prescription BOOLEAN DEFAULT false,
  supplier_id     UUID REFERENCES pharmacy_suppliers(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, sku)
);

CREATE INDEX IF NOT EXISTS idx_pharm_products_tenant  ON pharmacy_products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pharm_products_name    ON pharmacy_products(tenant_id, lower(name));
CREATE INDEX IF NOT EXISTS idx_pharm_products_active  ON pharmacy_products(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_pharm_products_low_stock
  ON pharmacy_products(tenant_id, quantity, reorder_level)
  WHERE quantity <= reorder_level;

-- Product packages (Strip=10, Box=100, etc.)
CREATE TABLE IF NOT EXISTS pharmacy_product_packages (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_id        UUID NOT NULL REFERENCES pharmacy_products(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  units_per_package INTEGER NOT NULL,
  price             DECIMAL(14,2) NOT NULL,
  is_default        BOOLEAN DEFAULT false,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  UNIQUE(product_id, name)
);

CREATE INDEX IF NOT EXISTS idx_pharm_pkg_product ON pharmacy_product_packages(product_id);

-- Product batches (FIFO by expiry)
CREATE TABLE IF NOT EXISTS pharmacy_product_batches (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_id       UUID NOT NULL REFERENCES pharmacy_products(id) ON DELETE CASCADE,
  batch_number     TEXT NOT NULL,
  quantity         INTEGER NOT NULL,
  initial_quantity INTEGER NOT NULL,
  expiry_date      DATE NOT NULL,
  received_date    TIMESTAMPTZ DEFAULT now(),
  cost_price       DECIMAL(14,2) NOT NULL,
  is_active        BOOLEAN DEFAULT true,
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE(product_id, batch_number)
);

CREATE INDEX IF NOT EXISTS idx_pharm_batch_product ON pharmacy_product_batches(product_id);
CREATE INDEX IF NOT EXISTS idx_pharm_batch_expiry  ON pharmacy_product_batches(expiry_date);
CREATE INDEX IF NOT EXISTS idx_pharm_batch_active  ON pharmacy_product_batches(product_id, is_active)
  WHERE is_active = true;

-- Stock adjustments (audit trail for quantity changes)
CREATE TABLE IF NOT EXISTS pharmacy_stock_adjustments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_id   UUID NOT NULL REFERENCES pharmacy_products(id) ON DELETE CASCADE,
  quantity     INTEGER NOT NULL,
  type         TEXT NOT NULL CHECK (type IN ('INCREASE', 'DECREASE', 'CORRECTION')),
  reason       TEXT,
  previous_qty INTEGER NOT NULL,
  new_qty      INTEGER NOT NULL,
  created_by   UUID REFERENCES profiles(id),
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pharm_adj_product ON pharmacy_stock_adjustments(product_id);
CREATE INDEX IF NOT EXISTS idx_pharm_adj_tenant  ON pharmacy_stock_adjustments(tenant_id);
