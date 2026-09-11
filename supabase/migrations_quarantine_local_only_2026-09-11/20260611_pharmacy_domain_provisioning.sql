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

CREATE TABLE IF NOT EXISTS pharmacy_onboarding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE UNIQUE,
  current_step INTEGER NOT NULL DEFAULT 0,
  invite_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  invite_sent_at TIMESTAMPTZ,
  invite_expires_at TIMESTAMPTZ DEFAULT now() + interval '7 days',
  account_created_at TIMESTAMPTZ,
  profile_completed_at TIMESTAMPTZ,
  store_setup_at TIMESTAMPTZ,
  first_product_at TIMESTAMPTZ,
  onboarding_completed_at TIMESTAMPTZ,
  enrolled_by UUID REFERENCES profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE pharmacy_orders
  ADD COLUMN IF NOT EXISTS patient_id UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS items JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS total_ugx INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fulfillment_type TEXT,
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS payment_ref TEXT;

ALTER TABLE pharmacy_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacy_network_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE drug_shortage_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacy_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacy_onboarding ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_pharmacy_profiles_tenant ON pharmacy_profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pharmacy_profiles_custom_domain ON pharmacy_profiles(custom_domain);
CREATE INDEX IF NOT EXISTS idx_pharmacy_inventory_tenant_drug ON pharmacy_network_inventory(pharmacy_tenant_id, drug_name);
CREATE INDEX IF NOT EXISTS idx_pharmacy_orders_tenant_status ON pharmacy_orders(tenant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pharmacy_onboarding_tenant ON pharmacy_onboarding(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pharmacy_onboarding_invite_token ON pharmacy_onboarding(invite_token);
CREATE INDEX IF NOT EXISTS idx_shortage_alerts_active_drug ON drug_shortage_alerts(is_active, drug_name);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_network_inv_tenant_drug'
  ) THEN
    ALTER TABLE pharmacy_network_inventory
      ADD CONSTRAINT uq_network_inv_tenant_drug UNIQUE (pharmacy_tenant_id, drug_name);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'pharmacy_profiles' AND policyname = 'platform_admin_pharmacy_profiles'
  ) THEN
    CREATE POLICY platform_admin_pharmacy_profiles ON pharmacy_profiles
      USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'pharmacy_profiles' AND policyname = 'tenant_pharmacy_profiles'
  ) THEN
    CREATE POLICY tenant_pharmacy_profiles ON pharmacy_profiles
      USING (tenant_id = (SELECT tenant_id FROM profiles WHERE profiles.id = auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'pharmacy_network_inventory' AND policyname = 'platform_admin_pharmacy_inventory'
  ) THEN
    CREATE POLICY platform_admin_pharmacy_inventory ON pharmacy_network_inventory
      USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'pharmacy_network_inventory' AND policyname = 'tenant_pharmacy_inventory'
  ) THEN
    CREATE POLICY tenant_pharmacy_inventory ON pharmacy_network_inventory
      USING (pharmacy_tenant_id = (SELECT tenant_id FROM profiles WHERE profiles.id = auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'pharmacy_orders' AND policyname = 'tenant_pharmacy_orders'
  ) THEN
    CREATE POLICY tenant_pharmacy_orders ON pharmacy_orders
      USING (tenant_id = (SELECT tenant_id FROM profiles WHERE profiles.id = auth.uid()) OR patient_id = auth.uid());
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'pharmacy_onboarding' AND policyname = 'invite_token_lookup'
  ) THEN
    DROP POLICY invite_token_lookup ON pharmacy_onboarding;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'pharmacy_onboarding' AND policyname = 'platform_admin_full'
  ) THEN
    CREATE POLICY platform_admin_full ON pharmacy_onboarding
      FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'pharmacy_onboarding' AND policyname = 'pharmacy_admin_own'
  ) THEN
    CREATE POLICY pharmacy_admin_own ON pharmacy_onboarding
      FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE profiles.id = auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'pharmacy_onboarding' AND policyname = 'pharmacy_user_update_onboarding'
  ) THEN
    CREATE POLICY pharmacy_user_update_onboarding ON pharmacy_onboarding
      FOR UPDATE
      USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE profiles.id = auth.uid() AND profiles.tenant_id IS NOT NULL))
      WITH CHECK (tenant_id IN (SELECT tenant_id FROM profiles WHERE profiles.id = auth.uid() AND profiles.tenant_id IS NOT NULL));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.fn_sync_network_inventory()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_is_network BOOLEAN;
BEGIN
  v_tenant_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.tenant_id ELSE NEW.tenant_id END;

  SELECT coalesce(is_network_member, false)
    INTO v_is_network
  FROM tenants
  WHERE id = v_tenant_id;

  IF NOT coalesce(v_is_network, false) THEN
    RETURN coalesce(NEW, OLD);
  END IF;

  IF TG_OP = 'DELETE' THEN
    UPDATE pharmacy_network_inventory
       SET quantity_in_stock = 0,
           last_synced_at = now()
     WHERE pharmacy_tenant_id = v_tenant_id
       AND drug_name = lower(trim(coalesce(OLD.name, 'Unknown')));
    RETURN OLD;
  END IF;

  INSERT INTO pharmacy_network_inventory (
    pharmacy_tenant_id,
    drug_name,
    generic_name,
    dosage_form,
    strength,
    quantity_in_stock,
    unit_price_ugx,
    last_synced_at
  ) VALUES (
    v_tenant_id,
    lower(trim(coalesce(NEW.name, 'Unknown'))),
    coalesce(NEW.generic_name, NEW.name, 'Unknown'),
    coalesce(NEW.dosage_form, 'Other'),
    coalesce(NEW.strength, ''),
    CASE WHEN coalesce(NEW.is_active, true) THEN coalesce(NEW.quantity, 0) ELSE 0 END,
    coalesce(NEW.price, 0),
    now()
  )
  ON CONFLICT (pharmacy_tenant_id, drug_name)
  DO UPDATE SET
    generic_name = EXCLUDED.generic_name,
    dosage_form = EXCLUDED.dosage_form,
    strength = EXCLUDED.strength,
    quantity_in_stock = EXCLUDED.quantity_in_stock,
    unit_price_ugx = EXCLUDED.unit_price_ugx,
    last_synced_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_network_inventory ON pharmacy_products;
CREATE TRIGGER trg_sync_network_inventory
  AFTER INSERT OR UPDATE OF quantity, price, name, generic_name, dosage_form, strength, is_active OR DELETE
  ON pharmacy_products
  FOR EACH ROW EXECUTE FUNCTION public.fn_sync_network_inventory();
