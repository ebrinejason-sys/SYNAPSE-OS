-- PROPOSED SEED — NOT an auto-applied migration (lives under supabase/proposed/).
-- Plan feature entitlements approved by product on 2026-09-27.
--
-- Idempotent : ON CONFLICT DO NOTHING everywhere; safe to run repeatedly.
-- Tenant-safe: only writes catalogue rows (plan_features, platform_billing_config).
--              Never reads, inserts, updates or deletes tenants, tenant_subscriptions,
--              tenant_feature_overrides or any tenant-owned data.
-- Plans that do not exist in the target database are silently skipped (JOIN).
--
-- OS Basic        = registration, opd, billing, reports
-- OS + Lab        = OS Basic + lab   (single-subscription plan: synapse_os_lab_addon_annual)
-- Standalone Lab  = lab, registration, billing, reports
-- Pharmacy annual = unchanged (already seeded)
-- Enterprise / custom / legacy hospital_* plans = intentionally EMPTY (no evidence).

BEGIN;

WITH mapping(plan_slug, feature_key) AS (
  VALUES
    ('synapse_os_basic_annual',     'registration'),
    ('synapse_os_basic_annual',     'opd'),
    ('synapse_os_basic_annual',     'billing'),
    ('synapse_os_basic_annual',     'reports'),
    ('synapse_os_lab_addon_annual', 'registration'),
    ('synapse_os_lab_addon_annual', 'opd'),
    ('synapse_os_lab_addon_annual', 'billing'),
    ('synapse_os_lab_addon_annual', 'reports'),
    ('synapse_os_lab_addon_annual', 'lab'),
    ('synapse_lab_annual',          'lab'),
    ('synapse_lab_annual',          'registration'),
    ('synapse_lab_annual',          'billing'),
    ('synapse_lab_annual',          'reports')
)
INSERT INTO public.plan_features (plan_id, feature_key)
SELECT sp.id, m.feature_key
FROM mapping m
JOIN public.subscription_plans sp ON sp.slug = m.plan_slug
ON CONFLICT (plan_id, feature_key) DO NOTHING;

-- Module -> feature registry used by gateHospitalModule(). Production already has
-- this exact value; environments built from a schema-only snapshot do not.
-- DO NOTHING: an existing registry is never overwritten.
INSERT INTO public.platform_billing_config (key, value)
VALUES ('hospital_module_registry', '[
  {"key":"core","label":"Facility Core","feature_key":null,"default_enabled":true},
  {"key":"registration","label":"Registration / HIM","feature_key":"registration","default_enabled":false},
  {"key":"opd","label":"OPD / Triage","feature_key":"opd","default_enabled":false},
  {"key":"clinical","label":"Doctor / Clinical","feature_key":"opd","default_enabled":false},
  {"key":"ipd","label":"Nursing / IPD","feature_key":"ipd","default_enabled":false},
  {"key":"lab","label":"Laboratory","feature_key":"lab","default_enabled":false},
  {"key":"radiology","label":"Radiology","feature_key":"radiology","default_enabled":false},
  {"key":"dispensing","label":"Hospital Dispensing","feature_key":"dispensing","default_enabled":false},
  {"key":"maternity","label":"Maternity","feature_key":"maternity","default_enabled":false},
  {"key":"immunization","label":"Immunization / Pediatrics","feature_key":"immunization","default_enabled":false},
  {"key":"theatre","label":"Theatre / Surgery","feature_key":"theatre","default_enabled":false},
  {"key":"emergency","label":"Emergency / Referrals","feature_key":"emergency","default_enabled":false},
  {"key":"mortuary","label":"Mortuary","feature_key":"mortuary","default_enabled":false},
  {"key":"support_ops","label":"Support Operations","feature_key":"support_ops","default_enabled":false},
  {"key":"hr","label":"HR-lite","feature_key":"hr","default_enabled":false},
  {"key":"billing","label":"Revenue / Billing","feature_key":"billing","default_enabled":false},
  {"key":"claims","label":"Insurance Claims","feature_key":"claims","default_enabled":false},
  {"key":"telemedicine","label":"Telemedicine","feature_key":"telemedicine","default_enabled":false},
  {"key":"reports","label":"Reports","feature_key":"reports","default_enabled":false},
  {"key":"public_health","label":"Public Health","feature_key":"public_health","default_enabled":false},
  {"key":"migration","label":"Data Migration","feature_key":"migration","default_enabled":false},
  {"key":"platform","label":"Platform Admin","feature_key":null,"default_enabled":true}
]'::jsonb)
ON CONFLICT (key) DO NOTHING;

COMMIT;
