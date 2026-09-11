-- Workstream A: Canonical Synapse Pharm pricing (UGX)
-- Live audit 2026-07-14 (project qfqakzmjatszisuqjwon):
--   - subscription_plans: no CHECK on billing_cycle (only 'monthly' values exist)
--   - tenant_subscriptions: no CHECK on status; lifecycle cols already present
--     (trial_ends, grace_until, cancel_at_period_end, current_period_start/end, last_payment_at)
--   - platform_billing_config: key='subscription' with grace_days=5 only
-- Suspensions only — never DELETE plan rows (pilot + FKs may still reference them).

-- ── A1: FX rate used to derive price_usd (do not hardcode in INSERT) ─────────
-- Codebase reference rate (~UGX 3,700/USD, June 2026 billing UI). Stored here
-- so price_usd stays derived from a single config constant.
INSERT INTO platform_billing_config (key, value, updated_at)
VALUES (
  'fx',
  jsonb_build_object('ugx_per_usd', 3700, 'source', 'platform_reference_2026_06', 'note', 'Used only to derive subscription_plans.price_usd display reference'),
  now()
)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = now();

-- Extend/replace billing_cycle CHECK to allow quarterly + yearly.
-- Pre-migration: pg_constraint showed ZERO check constraints on subscription_plans.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'subscription_plans_billing_cycle_check'
      AND conrelid = 'public.subscription_plans'::regclass
  ) THEN
    ALTER TABLE subscription_plans
      ADD CONSTRAINT subscription_plans_billing_cycle_check
      CHECK (billing_cycle IN ('monthly', 'quarterly', 'yearly'));
  END IF;
END $$;

-- ── A2: Suspend legacy pharmacy plans (never delete) ─────────────────────────
UPDATE subscription_plans
SET is_active = false,
    updated_at = now()
WHERE facility_type = 'pharmacy'
  AND slug IN (
    'pharmacy_starter',
    'pharmacy_growth',
    'pharmacy_multi_branch',
    'starter_pharmacy',
    'growth_pharmacy'
  );

-- ── A1: Upsert canonical Pharm plans ─────────────────────────────────────────
-- price_usd = ROUND(price_ugx / ugx_per_usd, 2) from platform_billing_config.fx
WITH fx AS (
  SELECT COALESCE((value->>'ugx_per_usd')::numeric, 3700) AS ugx_per_usd
  FROM platform_billing_config
  WHERE key = 'fx'
  LIMIT 1
),
canonical AS (
  SELECT * FROM (VALUES
    ('pharm_monthly',   'Pharm Monthly',   'monthly',   20000::numeric),
    ('pharm_quarterly', 'Pharm Quarterly', 'quarterly', 52000::numeric),
    ('pharm_yearly',    'Pharm Yearly',    'yearly',   200000::numeric)
  ) AS v(slug, name, billing_cycle, price_ugx)
)
INSERT INTO subscription_plans (
  slug, name, facility_type, price_usd, price_ugx, billing_cycle, is_active, updated_at
)
SELECT
  c.slug,
  c.name,
  'pharmacy',
  ROUND(c.price_ugx / fx.ugx_per_usd, 2),
  c.price_ugx,
  c.billing_cycle,
  true,
  now()
FROM canonical c
CROSS JOIN fx
ON CONFLICT (slug) DO UPDATE SET
  name          = EXCLUDED.name,
  facility_type = 'pharmacy',
  price_usd     = EXCLUDED.price_usd,
  price_ugx     = EXCLUDED.price_ugx,
  billing_cycle = EXCLUDED.billing_cycle,
  is_active     = true,
  updated_at    = now();

-- Seed core POS features on all three canonical plans (idempotent)
INSERT INTO plan_features (plan_id, feature_key, value)
SELECT p.id, f.feature_key, 'true'::jsonb
FROM subscription_plans p
CROSS JOIN (VALUES
  ('pos.sell'),
  ('inventory.read'),
  ('inventory.write'),
  ('receipts.print'),
  ('billing.view'),
  ('account.view'),
  ('data.read'),
  ('data.export'),
  ('reports.generate')
) AS f(feature_key)
WHERE p.slug IN ('pharm_monthly', 'pharm_quarterly', 'pharm_yearly')
ON CONFLICT (plan_id, feature_key) DO NOTHING;

-- ── A3: Protect CARE PLUS pilot ──────────────────────────────────────────────
-- CARE PLUS (tenant_id 15673a32-8c78-42b5-980a-bf00eb2e197b) was on
-- pharmacy_starter with current_period_end=2026-07-21. Billing SaaS is still
-- being built; locking the pilot out mid-July while checkout/webhooks land
-- would block the first real CARE PLUS sale. Courtesy period through 2026-10-14
-- (3 months from migration day 2026-07-14) on pharm_monthly.
UPDATE tenant_subscriptions ts
SET
  plan_id             = (SELECT id FROM subscription_plans WHERE slug = 'pharm_monthly' LIMIT 1),
  status              = 'active',
  current_period_end  = '2026-10-14'::timestamptz,
  current_period_start = COALESCE(ts.current_period_start, now()),
  cancel_at_period_end = false,
  updated_at          = now()
WHERE ts.tenant_id = '15673a32-8c78-42b5-980a-bf00eb2e197b';

-- ── A4: Subscription status state machine CHECK ──────────────────────────────
-- Pre-migration: no status CHECK existed. Only known live value: 'active'.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tenant_subscriptions_status_check'
      AND conrelid = 'public.tenant_subscriptions'::regclass
  ) THEN
    ALTER TABLE tenant_subscriptions
      ADD CONSTRAINT tenant_subscriptions_status_check
      CHECK (status IN ('trialing', 'active', 'past_due', 'suspended', 'cancelled'));
  END IF;
END $$;

-- ── G4 (folded): backfill onboarding_complete for admins of active/trialing ──
-- Prevents repeating the CARE PLUS manual-patch bug for existing tenants.
UPDATE profiles p
SET onboarding_complete = true,
    updated_at = now()
WHERE COALESCE(p.onboarding_complete, false) = false
  AND p.role IN ('admin', 'pharmacy_admin', 'owner', 'platform_admin')
  AND EXISTS (
    SELECT 1
    FROM tenant_subscriptions ts
    WHERE ts.tenant_id = p.tenant_id
      AND ts.status IN ('active', 'trialing')
  );
