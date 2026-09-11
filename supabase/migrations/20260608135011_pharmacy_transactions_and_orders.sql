-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260608135011  name: pharmacy_transactions_and_orders
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.


-- ============================================================
-- CUSTOMERS, CLIENTS, TRANSACTIONS, ORDERS
-- ============================================================

-- Customers (registered, can place online orders)
CREATE TABLE IF NOT EXISTS pharmacy_customers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email       TEXT,
  name        TEXT NOT NULL,
  phone       TEXT,
  address     TEXT,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pharm_customers_tenant ON pharmacy_customers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pharm_customers_email  ON pharmacy_customers(tenant_id, email);

-- Clients (walk-in, lighter record than customer)
CREATE TABLE IF NOT EXISTS pharmacy_clients (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  phone       TEXT,
  address     TEXT,
  notes       TEXT,
  last_visit  TIMESTAMPTZ,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pharm_clients_tenant ON pharmacy_clients(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pharm_clients_name   ON pharmacy_clients(tenant_id, lower(name));

-- POS Transactions (dispensing / sales)
CREATE TABLE IF NOT EXISTS pharmacy_transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  transaction_no  TEXT NOT NULL,
  customer_id     UUID REFERENCES pharmacy_customers(id) ON DELETE SET NULL,
  client_name     TEXT,
  client_phone    TEXT,
  client_address  TEXT,
  cashier_id      UUID NOT NULL REFERENCES profiles(id),
  total_amount    DECIMAL(14,2) NOT NULL,
  discount        DECIMAL(14,2) NOT NULL DEFAULT 0,
  tax             DECIMAL(14,2) NOT NULL DEFAULT 0,
  net_amount      DECIMAL(14,2) NOT NULL,
  payment_method  TEXT NOT NULL
    CHECK (payment_method IN ('CASH', 'CARD', 'MOBILE_MONEY', 'BANK_TRANSFER')),
  status          TEXT NOT NULL DEFAULT 'COMPLETED'
    CHECK (status IN ('PENDING', 'COMPLETED', 'CANCELLED', 'REFUNDED')),
  notes           TEXT,
  is_edited       BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, transaction_no)
);

CREATE INDEX IF NOT EXISTS idx_pharm_txn_tenant   ON pharmacy_transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pharm_txn_date     ON pharmacy_transactions(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pharm_txn_cashier  ON pharmacy_transactions(cashier_id);
CREATE INDEX IF NOT EXISTS idx_pharm_txn_customer ON pharmacy_transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_pharm_txn_no       ON pharmacy_transactions(tenant_id, transaction_no);

-- Transaction line items
CREATE TABLE IF NOT EXISTS pharmacy_transaction_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  transaction_id  UUID NOT NULL REFERENCES pharmacy_transactions(id) ON DELETE CASCADE,
  product_id      UUID NOT NULL REFERENCES pharmacy_products(id),
  batch_id        UUID REFERENCES pharmacy_product_batches(id),
  quantity        INTEGER NOT NULL,
  unit_price      DECIMAL(14,2) NOT NULL,
  cost_price      DECIMAL(14,2),
  total_price     DECIMAL(14,2) NOT NULL,
  package_name    TEXT,
  package_quantity INTEGER,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pharm_txn_items_txn     ON pharmacy_transaction_items(transaction_id);
CREATE INDEX IF NOT EXISTS idx_pharm_txn_items_product ON pharmacy_transaction_items(product_id);

-- Transaction edits (audit trail for modified transactions)
CREATE TABLE IF NOT EXISTS pharmacy_transaction_edits (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  transaction_id  UUID NOT NULL REFERENCES pharmacy_transactions(id) ON DELETE CASCADE,
  edited_by       UUID NOT NULL REFERENCES profiles(id),
  reason          TEXT NOT NULL,
  previous_data   JSONB NOT NULL,
  new_data        JSONB NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pharm_edits_txn ON pharmacy_transaction_edits(transaction_id);

-- Purchase orders (restocking from suppliers)
CREATE TABLE IF NOT EXISTS pharmacy_purchase_orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_no        TEXT NOT NULL,
  supplier_id     UUID NOT NULL REFERENCES pharmacy_suppliers(id),
  total_amount    DECIMAL(14,2) NOT NULL,
  status          TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'SENT', 'CONFIRMED', 'SHIPPED', 'RECEIVED', 'CANCELLED')),
  notes           TEXT,
  expected_date   DATE,
  email_sent      BOOLEAN DEFAULT false,
  email_sent_at   TIMESTAMPTZ,
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, order_no)
);

CREATE INDEX IF NOT EXISTS idx_pharm_po_tenant   ON pharmacy_purchase_orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pharm_po_supplier ON pharmacy_purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_pharm_po_status   ON pharmacy_purchase_orders(tenant_id, status);

-- Purchase order line items
CREATE TABLE IF NOT EXISTS pharmacy_purchase_order_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  purchase_order_id UUID NOT NULL REFERENCES pharmacy_purchase_orders(id) ON DELETE CASCADE,
  product_id        UUID REFERENCES pharmacy_products(id),
  product_name      TEXT NOT NULL,
  quantity          INTEGER NOT NULL,
  unit_price        DECIMAL(14,2) NOT NULL,
  total_price       DECIMAL(14,2) NOT NULL,
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pharm_po_items_po      ON pharmacy_purchase_order_items(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_pharm_po_items_product ON pharmacy_purchase_order_items(product_id);

-- Orders (customer/online orders)
CREATE TABLE IF NOT EXISTS pharmacy_orders (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_no         TEXT NOT NULL,
  customer_id      UUID REFERENCES pharmacy_customers(id) ON DELETE SET NULL,
  order_type       TEXT NOT NULL DEFAULT 'CUSTOMER'
    CHECK (order_type IN ('CUSTOMER', 'SUPPLIER')),
  total_amount     DECIMAL(14,2) NOT NULL,
  status           TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'PROCESSING', 'READY', 'COMPLETED', 'CANCELLED')),
  payment_status   TEXT NOT NULL DEFAULT 'UNPAID'
    CHECK (payment_status IN ('UNPAID', 'PARTIAL', 'PAID')),
  notes            TEXT,
  delivery_address TEXT,
  processed_by     UUID REFERENCES profiles(id),
  claimed_by       UUID REFERENCES profiles(id),
  claimed_at       TIMESTAMPTZ,
  is_online_order  BOOLEAN DEFAULT false,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, order_no)
);

CREATE INDEX IF NOT EXISTS idx_pharm_orders_tenant   ON pharmacy_orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pharm_orders_customer ON pharmacy_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_pharm_orders_status   ON pharmacy_orders(tenant_id, status);

-- Order line items
CREATE TABLE IF NOT EXISTS pharmacy_order_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_id    UUID NOT NULL REFERENCES pharmacy_orders(id) ON DELETE CASCADE,
  product_id  UUID REFERENCES pharmacy_products(id),
  product_name TEXT NOT NULL,
  quantity    INTEGER NOT NULL,
  unit_price  DECIMAL(14,2) NOT NULL,
  total_price DECIMAL(14,2) NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pharm_order_items_order   ON pharmacy_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_pharm_order_items_product ON pharmacy_order_items(product_id);
