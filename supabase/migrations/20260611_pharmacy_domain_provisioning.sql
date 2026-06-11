-- Pharmacy custom domain provisioning and routing metadata.

CREATE TABLE IF NOT EXISTS pharmacy_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  pharmacy_name TEXT,
  license_number TEXT,
  license_expiry DATE,
  district TEXT,
  physical_address TEXT,
  contact_person TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  default_domain TEXT,
  custom_domain TEXT UNIQUE,
  custom_domain_verified BOOLEAN NOT NULL DEFAULT false,
  custom_domain_verified_at TIMESTAMPTZ,
  vercel_domain_id TEXT,
  is_network_visible BOOLEAN NOT NULL DEFAULT true,
  delivery_available BOOLEAN NOT NULL DEFAULT false,
  delivery_radius_km INTEGER,
  migrated_from TEXT,
  migration_status TEXT NOT NULL DEFAULT 'pending',
  migration_completed_at TIMESTAMPTZ,
  logo_url TEXT,
  theme_color TEXT NOT NULL DEFAULT '#F97316',
  network_joined_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE pharmacy_profiles
  ADD COLUMN IF NOT EXISTS domain_status TEXT DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS domain_verification JSONB,
  ADD COLUMN IF NOT EXISTS domain_error TEXT,
  ADD COLUMN IF NOT EXISTS domain_configured_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_domain_check_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS vercel_domain_id TEXT;

CREATE TABLE IF NOT EXISTS pharmacy_network_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  drug_name TEXT NOT NULL,
  generic_name TEXT,
  brand_name TEXT,
  dosage_form TEXT,
  strength TEXT,
  quantity_in_stock INTEGER NOT NULL DEFAULT 0,
  unit_price_ugx NUMERIC(12,2),
  is_available BOOLEAN GENERATED ALWAYS AS (quantity_in_stock > 0) STORED,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS drug_shortage_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drug_name TEXT NOT NULL,
  generic_name TEXT,
  drug_code TEXT,
  alert_level TEXT NOT NULL CHECK (alert_level IN ('watch','warning','critical')),
  affected_districts TEXT[] NOT NULL DEFAULT '{}',
  pharmacy_count_affected INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS pharmacy_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id UUID REFERENCES profiles(id),
  order_ref TEXT UNIQUE NOT NULL DEFAULT ('ORD-' || upper(substr(md5(random()::text), 1, 8))),
  items JSONB NOT NULL DEFAULT '[]',
  total_ugx INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','preparing','ready','dispatched','delivered','cancelled')),
  fulfillment_type TEXT CHECK (fulfillment_type IN ('pickup','delivery')),
  prescription_id UUID,
  notes TEXT,
  payment_status TEXT NOT NULL DEFAULT 'unpaid',
  payment_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE pharmacy_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacy_network_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE drug_shortage_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacy_orders ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_pharmacy_profiles_tenant ON pharmacy_profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pharmacy_profiles_custom_domain ON pharmacy_profiles(custom_domain);
CREATE INDEX IF NOT EXISTS idx_pharmacy_inventory_tenant_drug ON pharmacy_network_inventory(pharmacy_tenant_id, drug_name);
CREATE INDEX IF NOT EXISTS idx_pharmacy_orders_tenant_status ON pharmacy_orders(tenant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shortage_alerts_active_drug ON drug_shortage_alerts(is_active, drug_name);
