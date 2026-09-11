-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260612230655  name: subscriptions_and_feature_gates
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.


-- Phase 3: Subscription plans, feature gates, tenant subscriptions
-- Additive only — CREATE TABLE IF NOT EXISTS, ON CONFLICT DO NOTHING

-- ── Subscription plans ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS subscription_plans (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text UNIQUE NOT NULL,
  name          text NOT NULL,
  facility_type text NOT NULL, -- pharmacy | clinic | hospital | homecare | ngo | lab
  price_usd     numeric(10,2),
  billing_cycle text NOT NULL DEFAULT 'monthly', -- monthly | annual
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ── Plan features ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS plan_features (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id     uuid NOT NULL REFERENCES subscription_plans(id) ON DELETE CASCADE,
  feature_key text NOT NULL,   -- e.g. 'pos', 'insurance_copilot', 'longitudinal'
  value       jsonb,           -- optional config: { limit: 5 } or true
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_id, feature_key)
);

CREATE INDEX IF NOT EXISTS plan_features_plan_id_idx ON plan_features(plan_id);
CREATE INDEX IF NOT EXISTS plan_features_key_idx     ON plan_features(feature_key);

-- ── Tenant subscriptions ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tenant_subscriptions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan_id     uuid NOT NULL REFERENCES subscription_plans(id),
  status      text NOT NULL DEFAULT 'active', -- active | suspended | cancelled | trial
  trial_ends  timestamptz,
  starts_at   timestamptz NOT NULL DEFAULT now(),
  ends_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id)
);

CREATE INDEX IF NOT EXISTS tenant_subs_tenant_id_idx ON tenant_subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS tenant_subs_plan_id_idx   ON tenant_subscriptions(plan_id);

-- ── Tenant feature overrides ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tenant_feature_overrides (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  feature_key text NOT NULL,
  enabled     boolean NOT NULL DEFAULT true,
  value       jsonb,
  reason      text,
  granted_by  uuid REFERENCES profiles(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, feature_key)
);

CREATE INDEX IF NOT EXISTS tenant_feat_overrides_tenant_idx ON tenant_feature_overrides(tenant_id);

-- ── RLS ────────────────────────────────────────────────────────────────────

ALTER TABLE subscription_plans         ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_features              ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_subscriptions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_feature_overrides   ENABLE ROW LEVEL SECURITY;

-- subscription_plans: public read, service-role write
DROP POLICY IF EXISTS subscription_plans_read  ON subscription_plans;
CREATE POLICY subscription_plans_read ON subscription_plans
  FOR SELECT USING (true);

-- plan_features: public read
DROP POLICY IF EXISTS plan_features_read ON plan_features;
CREATE POLICY plan_features_read ON plan_features
  FOR SELECT USING (true);

-- tenant_subscriptions: tenant members can read their own
DROP POLICY IF EXISTS tenant_subs_read ON tenant_subscriptions;
CREATE POLICY tenant_subs_read ON tenant_subscriptions
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );

-- tenant_feature_overrides: tenant members can read their own
DROP POLICY IF EXISTS tenant_feat_overrides_read ON tenant_feature_overrides;
CREATE POLICY tenant_feat_overrides_read ON tenant_feature_overrides
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );

-- ── has_feature() — SECURITY DEFINER ────────────────────────────────────────

CREATE OR REPLACE FUNCTION has_feature(
  p_tenant_id  uuid,
  p_feature    text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_override_enabled boolean;
  v_has_plan_feature boolean;
  v_sub_status       text;
BEGIN
  -- 1. Check tenant-level override first
  SELECT enabled INTO v_override_enabled
  FROM tenant_feature_overrides
  WHERE tenant_id = p_tenant_id AND feature_key = p_feature;

  IF FOUND THEN
    RETURN v_override_enabled;
  END IF;

  -- 2. Check active subscription plan
  SELECT ts.status, EXISTS(
    SELECT 1
    FROM plan_features pf
    WHERE pf.plan_id = ts.plan_id AND pf.feature_key = p_feature
  )
  INTO v_sub_status, v_has_plan_feature
  FROM tenant_subscriptions ts
  WHERE ts.tenant_id = p_tenant_id;

  IF NOT FOUND THEN
    RETURN false; -- no subscription
  END IF;

  IF v_sub_status NOT IN ('active', 'trial') THEN
    RETURN false;
  END IF;

  RETURN v_has_plan_feature;
END;
$$;

-- ── Seed plans ──────────────────────────────────────────────────────────────

INSERT INTO subscription_plans (slug, name, facility_type, price_usd) VALUES
  ('starter_pharmacy',  'Starter Pharmacy',     'pharmacy',  29.00),
  ('growth_pharmacy',   'Growth Pharmacy',       'pharmacy',  79.00),
  ('clinic_basic',      'Clinic Basic',          'clinic',    49.00),
  ('clinic_pro',        'Clinic Pro',            'clinic',    149.00),
  ('hospital_network',  'Hospital Network',      'hospital',  299.00),
  ('homecare_basic',    'Homecare Basic',        'homecare',  39.00),
  ('ngo_program',       'NGO Program',           'ngo',       19.00),
  ('lab_basic',         'Lab Basic',             'lab',       29.00)
ON CONFLICT (slug) DO NOTHING;

-- ── Seed plan features ──────────────────────────────────────────────────────

-- starter_pharmacy
INSERT INTO plan_features (plan_id, feature_key)
SELECT id, unnest(ARRAY['pos', 'inventory', 'suppliers', 'bulk_upload'])
FROM subscription_plans WHERE slug = 'starter_pharmacy'
ON CONFLICT (plan_id, feature_key) DO NOTHING;

-- growth_pharmacy
INSERT INTO plan_features (plan_id, feature_key)
SELECT id, unnest(ARRAY['pos', 'inventory', 'suppliers', 'bulk_upload',
  'insurance_copilot', 'analytics', 'multi_store'])
FROM subscription_plans WHERE slug = 'growth_pharmacy'
ON CONFLICT (plan_id, feature_key) DO NOTHING;

-- clinic_basic
INSERT INTO plan_features (plan_id, feature_key)
SELECT id, unnest(ARRAY['clinical', 'lab', 'pharmacy', 'pos'])
FROM subscription_plans WHERE slug = 'clinic_basic'
ON CONFLICT (plan_id, feature_key) DO NOTHING;

-- clinic_pro
INSERT INTO plan_features (plan_id, feature_key)
SELECT id, unnest(ARRAY['clinical', 'lab', 'pharmacy', 'pos',
  'insurance_copilot', 'longitudinal', 'reasoning', 'analytics'])
FROM subscription_plans WHERE slug = 'clinic_pro'
ON CONFLICT (plan_id, feature_key) DO NOTHING;

-- hospital_network
INSERT INTO plan_features (plan_id, feature_key)
SELECT id, unnest(ARRAY['clinical', 'lab', 'pharmacy', 'pos',
  'insurance_copilot', 'longitudinal', 'reasoning', 'analytics',
  'multi_store', 'billing', 'homecare'])
FROM subscription_plans WHERE slug = 'hospital_network'
ON CONFLICT (plan_id, feature_key) DO NOTHING;

-- homecare_basic
INSERT INTO plan_features (plan_id, feature_key)
SELECT id, unnest(ARRAY['clinical', 'homecare', 'analytics'])
FROM subscription_plans WHERE slug = 'homecare_basic'
ON CONFLICT (plan_id, feature_key) DO NOTHING;

-- ngo_program
INSERT INTO plan_features (plan_id, feature_key)
SELECT id, unnest(ARRAY['clinical', 'lab', 'pharmacy', 'analytics'])
FROM subscription_plans WHERE slug = 'ngo_program'
ON CONFLICT (plan_id, feature_key) DO NOTHING;

-- lab_basic
INSERT INTO plan_features (plan_id, feature_key)
SELECT id, unnest(ARRAY['lab', 'analytics'])
FROM subscription_plans WHERE slug = 'lab_basic'
ON CONFLICT (plan_id, feature_key) DO NOTHING;
