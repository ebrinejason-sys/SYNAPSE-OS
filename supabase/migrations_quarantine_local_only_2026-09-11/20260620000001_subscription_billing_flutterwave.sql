-- Subscription billing + Flutterwave payment ledger
-- Additive migration — safe to run against live project qfqakzmjatszisuqjwon

-- ── Config ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS platform_billing_config (
  key   text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO platform_billing_config (key, value)
VALUES ('subscription', jsonb_build_object('grace_days', 5))
ON CONFLICT (key) DO NOTHING;

-- ── Plans (create if missing on older envs) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS subscription_plans (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text UNIQUE NOT NULL,
  name          text NOT NULL,
  facility_type text NOT NULL DEFAULT 'pharmacy',
  price_usd     numeric,
  price_ugx     numeric,
  billing_cycle text NOT NULL DEFAULT 'monthly',
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS price_ugx numeric;

CREATE TABLE IF NOT EXISTS plan_features (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id     uuid NOT NULL REFERENCES subscription_plans(id) ON DELETE CASCADE,
  feature_key text NOT NULL,
  value       jsonb NOT NULL DEFAULT 'true'::jsonb,
  UNIQUE (plan_id, feature_key)
);

CREATE TABLE IF NOT EXISTS tenant_subscriptions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan_id     uuid REFERENCES subscription_plans(id),
  status      text NOT NULL DEFAULT 'trialing',
  starts_at   timestamptz DEFAULT now(),
  ends_at     timestamptz,
  trial_ends  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id)
);

ALTER TABLE tenant_subscriptions ADD COLUMN IF NOT EXISTS current_period_start timestamptz;
ALTER TABLE tenant_subscriptions ADD COLUMN IF NOT EXISTS current_period_end   timestamptz;
ALTER TABLE tenant_subscriptions ADD COLUMN IF NOT EXISTS grace_until          timestamptz;
ALTER TABLE tenant_subscriptions ADD COLUMN IF NOT EXISTS last_payment_at      timestamptz;
ALTER TABLE tenant_subscriptions ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean DEFAULT false;

CREATE TABLE IF NOT EXISTS tenant_feature_overrides (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  feature_key text NOT NULL,
  enabled     boolean NOT NULL,
  UNIQUE (tenant_id, feature_key)
);

-- ── Payment ledger ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscription_payments (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  subscription_id  uuid REFERENCES tenant_subscriptions(id),
  plan_id          uuid REFERENCES subscription_plans(id),
  amount_ugx       numeric NOT NULL,
  currency         text NOT NULL DEFAULT 'UGX',
  method           text,
  provider         text NOT NULL DEFAULT 'flutterwave',
  provider_tx_ref  text UNIQUE,
  provider_tx_id   text,
  status           text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','successful','failed','refunded')),
  period_start     timestamptz,
  period_end       timestamptz,
  raw_payload      jsonb,
  created_at       timestamptz NOT NULL DEFAULT now(),
  confirmed_at     timestamptz
);

CREATE INDEX IF NOT EXISTS idx_sub_payments_tenant  ON subscription_payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sub_payments_status  ON subscription_payments(status);
CREATE INDEX IF NOT EXISTS idx_sub_payments_created ON subscription_payments(created_at DESC);

CREATE TABLE IF NOT EXISTS subscription_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  from_status text,
  to_status   text,
  reason      text,
  actor       text,
  metadata    jsonb DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sub_events_tenant ON subscription_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sub_events_created ON subscription_events(created_at DESC);

-- ── Seed pharmacy plans (idempotent) ─────────────────────────────────────────
INSERT INTO subscription_plans (slug, name, facility_type, price_usd, price_ugx, billing_cycle, is_active)
VALUES
  ('pharmacy_starter',      'Pharmacy Starter',      'pharmacy', 29,  250000,  'monthly', true),
  ('pharmacy_growth',       'Pharmacy Growth',       'pharmacy', 59,  750000,  'monthly', true),
  ('pharmacy_multi_branch','Pharmacy Multi-Branch', 'pharmacy', 99, 1500000, 'monthly', true)
ON CONFLICT (slug) DO UPDATE SET
  price_ugx = COALESCE(EXCLUDED.price_ugx, subscription_plans.price_ugx),
  name = EXCLUDED.name,
  is_active = true;

-- Plan features for pharmacy tiers
INSERT INTO plan_features (plan_id, feature_key, value)
SELECT p.id, f.feature_key, 'true'::jsonb
FROM subscription_plans p
CROSS JOIN (VALUES
  ('pos.sell'), ('inventory.read'), ('inventory.write'), ('receipts.print'),
  ('billing.view'), ('account.view'), ('data.read'), ('data.export')
) AS f(feature_key)
WHERE p.slug = 'pharmacy_starter'
ON CONFLICT (plan_id, feature_key) DO NOTHING;

INSERT INTO plan_features (plan_id, feature_key, value)
SELECT p.id, f.feature_key, 'true'::jsonb
FROM subscription_plans p
CROSS JOIN (VALUES
  ('pos.sell'), ('inventory.read'), ('inventory.write'), ('receipts.print'),
  ('billing.view'), ('account.view'), ('data.read'), ('data.export'),
  ('network.listing'), ('refill.reminders'), ('reports.generate'), ('whatsapp.alerts')
) AS f(feature_key)
WHERE p.slug = 'pharmacy_growth'
ON CONFLICT (plan_id, feature_key) DO NOTHING;

INSERT INTO plan_features (plan_id, feature_key, value)
SELECT p.id, f.feature_key, 'true'::jsonb
FROM subscription_plans p
CROSS JOIN (VALUES
  ('pos.sell'), ('inventory.read'), ('inventory.write'), ('receipts.print'),
  ('billing.view'), ('account.view'), ('data.read'), ('data.export'),
  ('network.listing'), ('refill.reminders'), ('reports.generate'), ('whatsapp.alerts'),
  ('multi_branch.inventory'), ('multi_branch.transfers')
) AS f(feature_key)
WHERE p.slug = 'pharmacy_multi_branch'
ON CONFLICT (plan_id, feature_key) DO NOTHING;

-- ── Helpers ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION billing_grace_days()
RETURNS integer
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE((value->>'grace_days')::integer, 5)
  FROM platform_billing_config
  WHERE key = 'subscription'
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION log_subscription_event(
  p_tenant_id uuid,
  p_from_status text,
  p_to_status text,
  p_reason text,
  p_actor text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO subscription_events (tenant_id, from_status, to_status, reason, actor, metadata)
  VALUES (p_tenant_id, p_from_status, p_to_status, p_reason, p_actor, p_metadata);
END;
$$;

-- ── has_feature (enforcement spine) ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION has_feature(p_tenant_id uuid, p_feature text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_override boolean;
  v_status   text;
  v_grace    timestamptz;
  v_plan_id  uuid;
  v_has_plan boolean;
  v_readonly text[] := ARRAY[
    'billing.view', 'account.view', 'data.read', 'data.export'
  ];
BEGIN
  -- Per-tenant override wins
  SELECT enabled INTO v_override
  FROM tenant_feature_overrides
  WHERE tenant_id = p_tenant_id AND feature_key = p_feature
  LIMIT 1;

  IF FOUND THEN
    RETURN v_override;
  END IF;

  SELECT ts.status, ts.grace_until, ts.plan_id
  INTO v_status, v_grace, v_plan_id
  FROM tenant_subscriptions ts
  WHERE ts.tenant_id = p_tenant_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Full access: active, trial/trialing, or past_due within grace
  IF v_status IN ('active', 'trial', 'trialing') THEN
    SELECT EXISTS (
      SELECT 1 FROM plan_features pf
      WHERE pf.plan_id = v_plan_id AND pf.feature_key = p_feature
    ) INTO v_has_plan;
    RETURN COALESCE(v_has_plan, false);
  END IF;

  IF v_status = 'past_due' AND v_grace IS NOT NULL AND now() < v_grace THEN
    SELECT EXISTS (
      SELECT 1 FROM plan_features pf
      WHERE pf.plan_id = v_plan_id AND pf.feature_key = p_feature
    ) INTO v_has_plan;
    RETURN COALESCE(v_has_plan, false);
  END IF;

  -- Suspended / cancelled / past_due after grace — read-only allowlist
  IF v_status IN ('past_due', 'suspended', 'cancelled') THEN
    RETURN p_feature = ANY(v_readonly);
  END IF;

  RETURN false;
END;
$$;

-- ── State machine ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION advance_subscription_state(p_tenant_id uuid, p_actor text DEFAULT 'cron')
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sub tenant_subscriptions%ROWTYPE;
  v_grace_days integer;
  v_new_status text;
BEGIN
  SELECT * INTO sub FROM tenant_subscriptions WHERE tenant_id = p_tenant_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN 'no_subscription';
  END IF;

  v_grace_days := billing_grace_days();
  v_new_status := sub.status;

  -- Trial expired → past_due
  IF sub.status IN ('trialing', 'trial')
     AND sub.trial_ends IS NOT NULL
     AND now() >= sub.trial_ends THEN
    v_new_status := 'past_due';
    UPDATE tenant_subscriptions SET
      status = v_new_status,
      grace_until = now() + (v_grace_days || ' days')::interval,
      updated_at = now()
    WHERE tenant_id = p_tenant_id;
    PERFORM log_subscription_event(p_tenant_id, sub.status, v_new_status, 'trial_ended', p_actor);
    RETURN v_new_status;
  END IF;

  -- Active period ended → past_due + grace
  IF sub.status = 'active'
     AND sub.current_period_end IS NOT NULL
     AND now() >= sub.current_period_end THEN
    v_new_status := 'past_due';
    UPDATE tenant_subscriptions SET
      status = v_new_status,
      grace_until = now() + (v_grace_days || ' days')::interval,
      updated_at = now()
    WHERE tenant_id = p_tenant_id;
    PERFORM log_subscription_event(p_tenant_id, sub.status, v_new_status, 'period_ended', p_actor);
    RETURN v_new_status;
  END IF;

  -- Grace expired → suspended
  IF sub.status = 'past_due'
     AND sub.grace_until IS NOT NULL
     AND now() >= sub.grace_until THEN
    v_new_status := 'suspended';
    UPDATE tenant_subscriptions SET
      status = v_new_status,
      updated_at = now()
    WHERE tenant_id = p_tenant_id;
    PERFORM log_subscription_event(p_tenant_id, sub.status, v_new_status, 'grace_expired', p_actor);
    RETURN v_new_status;
  END IF;

  RETURN sub.status;
END;
$$;

CREATE OR REPLACE FUNCTION advance_all_subscriptions(p_actor text DEFAULT 'cron')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_changed integer := 0;
  v_checked integer := 0;
  v_result text;
BEGIN
  FOR r IN SELECT tenant_id FROM tenant_subscriptions LOOP
    v_checked := v_checked + 1;
    v_result := advance_subscription_state(r.tenant_id, p_actor);
    IF v_result NOT IN ('no_subscription') THEN
      v_changed := v_changed + 1;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('checked', v_checked, 'processed', v_changed, 'at', now());
END;
$$;

-- ── Activate subscription on successful payment ──────────────────────────────
CREATE OR REPLACE FUNCTION activate_subscription_payment(p_payment_id uuid, p_actor text DEFAULT 'webhook')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pay subscription_payments%ROWTYPE;
  sub tenant_subscriptions%ROWTYPE;
  v_period_end timestamptz;
BEGIN
  SELECT * INTO pay FROM subscription_payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'payment_not_found');
  END IF;
  IF pay.status = 'successful' THEN
    RETURN jsonb_build_object('ok', true, 'idempotent', true);
  END IF;

  v_period_end := COALESCE(pay.period_end, now() + interval '1 month');

  UPDATE subscription_payments SET
    status = 'successful',
    confirmed_at = now()
  WHERE id = p_payment_id;

  SELECT * INTO sub FROM tenant_subscriptions WHERE tenant_id = pay.tenant_id FOR UPDATE;

  IF FOUND THEN
    UPDATE tenant_subscriptions SET
      plan_id = COALESCE(pay.plan_id, sub.plan_id),
      status = 'active',
      current_period_start = COALESCE(pay.period_start, now()),
      current_period_end = v_period_end,
      grace_until = NULL,
      last_payment_at = now(),
      updated_at = now()
    WHERE tenant_id = pay.tenant_id;
    PERFORM log_subscription_event(
      pay.tenant_id, sub.status, 'active', 'payment_confirmed', p_actor,
      jsonb_build_object('payment_id', p_payment_id, 'amount_ugx', pay.amount_ugx)
    );
  ELSE
    INSERT INTO tenant_subscriptions (
      tenant_id, plan_id, status,
      current_period_start, current_period_end, last_payment_at
    ) VALUES (
      pay.tenant_id, pay.plan_id, 'active',
      COALESCE(pay.period_start, now()), v_period_end, now()
    );
    PERFORM log_subscription_event(
      pay.tenant_id, NULL, 'active', 'payment_confirmed_new_sub', p_actor,
      jsonb_build_object('payment_id', p_payment_id)
    );
  END IF;

  UPDATE tenants SET status = 'active', updated_at = now() WHERE id = pay.tenant_id;

  RETURN jsonb_build_object('ok', true, 'tenant_id', pay.tenant_id, 'period_end', v_period_end);
END;
$$;

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE subscription_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS subscription_payments_tenant_read ON subscription_payments;
CREATE POLICY subscription_payments_tenant_read ON subscription_payments
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS subscription_events_tenant_read ON subscription_events;
CREATE POLICY subscription_events_tenant_read ON subscription_events
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid())
  );

-- Service role bypasses RLS; anon/authenticated cannot insert payments directly

GRANT EXECUTE ON FUNCTION has_feature(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION advance_subscription_state(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION advance_all_subscriptions(text) TO service_role;
GRANT EXECUTE ON FUNCTION activate_subscription_payment(uuid, text) TO service_role;
