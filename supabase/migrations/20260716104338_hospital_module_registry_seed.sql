-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260716104338  name: hospital_module_registry_seed
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.

-- Phase 0: Hospital module registry + capability seed (CONFIG ONLY)
-- FLAG-OFF: no hospital_modules tenant rows, no plan_features for hospital plans
-- Safe to run against live project qfqakzmjatszisuqjwon (idempotent)

-- ── Ensure capability lattice tables exist (local dev parity) ─────────────────
CREATE TABLE IF NOT EXISTS capabilities (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module      text NOT NULL,
  resource    text NOT NULL,
  action      text NOT NULL,
  description text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (module, resource, action)
);

CREATE TABLE IF NOT EXISTS role_capabilities (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role           text NOT NULL,
  facility_type  text NOT NULL DEFAULT 'any',
  capability_id  uuid NOT NULL REFERENCES capabilities(id) ON DELETE CASCADE,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role, facility_type, capability_id)
);

CREATE INDEX IF NOT EXISTS idx_capabilities_module ON capabilities(module);
CREATE INDEX IF NOT EXISTS idx_role_capabilities_role ON role_capabilities(role);

-- ── Module registry catalog (no new table — platform_billing_config) ───────────
INSERT INTO platform_billing_config (key, value)
VALUES (
  'hospital_module_registry',
  jsonb_build_array(
    jsonb_build_object('key','core','label','Facility Core','default_enabled',true,'feature_key',null),
    jsonb_build_object('key','registration','label','Registration / HIM','default_enabled',false,'feature_key','registration'),
    jsonb_build_object('key','opd','label','OPD / Triage','default_enabled',false,'feature_key','opd'),
    jsonb_build_object('key','clinical','label','Doctor / Clinical','default_enabled',false,'feature_key','opd'),
    jsonb_build_object('key','ipd','label','Nursing / IPD','default_enabled',false,'feature_key','ipd'),
    jsonb_build_object('key','lab','label','Laboratory','default_enabled',false,'feature_key','lab'),
    jsonb_build_object('key','radiology','label','Radiology','default_enabled',false,'feature_key','radiology'),
    jsonb_build_object('key','dispensing','label','Hospital Dispensing','default_enabled',false,'feature_key','dispensing'),
    jsonb_build_object('key','maternity','label','Maternity','default_enabled',false,'feature_key','maternity'),
    jsonb_build_object('key','immunization','label','Immunization / Pediatrics','default_enabled',false,'feature_key','immunization'),
    jsonb_build_object('key','theatre','label','Theatre / Surgery','default_enabled',false,'feature_key','theatre'),
    jsonb_build_object('key','emergency','label','Emergency / Referrals','default_enabled',false,'feature_key','emergency'),
    jsonb_build_object('key','mortuary','label','Mortuary','default_enabled',false,'feature_key','mortuary'),
    jsonb_build_object('key','support_ops','label','Support Operations','default_enabled',false,'feature_key','support_ops'),
    jsonb_build_object('key','hr','label','HR-lite','default_enabled',false,'feature_key','hr'),
    jsonb_build_object('key','billing','label','Revenue / Billing','default_enabled',false,'feature_key','billing'),
    jsonb_build_object('key','claims','label','Insurance Claims','default_enabled',false,'feature_key','claims'),
    jsonb_build_object('key','telemedicine','label','Telemedicine','default_enabled',false,'feature_key','telemedicine'),
    jsonb_build_object('key','reports','label','Reports','default_enabled',false,'feature_key','reports'),
    jsonb_build_object('key','public_health','label','Public Health','default_enabled',false,'feature_key','public_health'),
    jsonb_build_object('key','migration','label','Data Migration','default_enabled',false,'feature_key','migration'),
    jsonb_build_object('key','platform','label','Platform Admin','default_enabled',true,'feature_key',null)
  )
)
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = now();

-- ── Hospital subscription plan shells (NO plan_features = FLAG-OFF) ────────────
INSERT INTO subscription_plans (slug, name, facility_type, price_usd, price_ugx, billing_cycle, is_active)
VALUES
  ('hospital_starter',      'Hospital Starter',      'hospital', 199,  1500000, 'monthly', true),
  ('hospital_professional', 'Hospital Professional', 'hospital', 399,  3500000, 'monthly', true),
  ('hospital_enterprise',   'Hospital Enterprise',   'hospital', 799,  7500000, 'monthly', true)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  facility_type = EXCLUDED.facility_type,
  price_ugx = COALESCE(EXCLUDED.price_ugx, subscription_plans.price_ugx),
  is_active = true;

-- ── Hospital module capabilities (additive) ───────────────────────────────────
INSERT INTO capabilities (module, resource, action, description)
SELECT v.module, v.resource, v.action, v.description
FROM (VALUES
  -- OPD / Triage
  ('opd', 'queue',       'read',   'View OPD queue'),
  ('opd', 'queue',       'write',  'Manage OPD queue'),
  ('opd', 'triage',      'assign', 'Assign triage acuity'),
  ('opd', 'encounter',   'create', 'Create OPD encounter'),
  -- IPD / Ward
  ('ipd', 'admission',   'create', 'Admit patient to ward'),
  ('ipd', 'admission',   'read',   'View admissions'),
  ('ward', 'bed',        'read',   'View bed board'),
  ('ward', 'bed',        'assign', 'Assign patient to bed'),
  ('ward', 'bed',        'release','Release bed'),
  ('ward', 'round',      'write',  'Document ward round'),
  -- Lab
  ('lab', 'order',       'create', 'Create lab order'),
  ('lab', 'order',       'read',   'View lab orders'),
  ('lab', 'result',      'enter',  'Enter lab result'),
  ('lab', 'result',      'verify', 'Verify lab result'),
  -- Radiology
  ('radiology', 'order',  'create', 'Create imaging order'),
  ('radiology', 'order',  'read',   'View imaging orders'),
  ('radiology', 'report', 'write',  'Draft radiology report'),
  ('radiology', 'report', 'verify', 'Verify radiology report'),
  -- Maternity
  ('maternity', 'record', 'read',   'View maternity record'),
  ('maternity', 'record', 'write',  'Update maternity record'),
  ('maternity', 'partograph', 'write', 'Document partograph'),
  -- Theatre
  ('theatre', 'schedule', 'read',  'View OR schedule'),
  ('theatre', 'schedule', 'write', 'Schedule surgery'),
  ('theatre', 'checklist','verify','Complete surgical checklist'),
  -- Mortuary
  ('mortuary', 'register', 'read',  'View body register'),
  ('mortuary', 'register', 'write', 'Admit body to mortuary'),
  ('mortuary', 'release',  'approve','Approve body release'),
  -- Billing / Claims
  ('billing', 'invoice',  'create', 'Create patient invoice'),
  ('billing', 'invoice',  'read',   'View invoices'),
  ('billing', 'payment',  'record', 'Record payment'),
  ('claims',  'claim',    'submit', 'Submit insurance claim'),
  ('claims',  'preauth',  'draft',  'Draft pre-authorization'),
  -- Telemedicine
  ('telemedicine', 'session', 'read',  'View telemedicine session'),
  ('telemedicine', 'session', 'write', 'Conduct telemedicine session'),
  ('telemedicine', 'intake',  'triage','Triage telemedicine intake'),
  -- Reports
  ('reports', 'generate', 'read',   'View reports'),
  ('reports', 'export',   'run',    'Export report data'),
  -- Migration
  ('migrate', 'import',   'run',    'Execute data import'),
  ('migrate', 'import',   'read',   'View import batches'),
  ('migrate', 'batch',    'admin',  'Administer import batches'),
  -- Registration / HIM
  ('registration', 'patient', 'register', 'Register new patient'),
  ('registration', 'record',  'merge',    'Merge duplicate records'),
  -- Emergency
  ('emergency', 'triage',  'assign', 'Assign emergency triage'),
  ('emergency', 'resus',   'document','Document resuscitation'),
  -- Immunization
  ('immunization', 'schedule', 'read',  'View immunization schedule'),
  ('immunization', 'schedule', 'write', 'Update immunization schedule'),
  ('immunization', 'dose',     'administer','Record vaccine administration'),
  -- Public health
  ('public_health', 'surveillance', 'report', 'Submit surveillance report'),
  ('public_health', 'dhis2',        'export', 'Export DHIS2 data'),
  -- HR-lite
  ('hr', 'staff',      'read',   'View staff roster'),
  ('hr', 'attendance', 'record', 'Record attendance'),
  -- Hospital dispensing (not POS)
  ('dispensing', 'order',     'fulfill', 'Fulfill hospital drug order'),
  ('dispensing', 'inventory', 'read',    'View hospital formulary stock'),
  -- Support ops
  ('support', 'housekeeping', 'write', 'Manage housekeeping tasks'),
  ('support', 'visitor',      'write', 'Log visitor entry'),
  -- Hospital admin console (CONFIG module)
  ('config', 'settings',   'read',  'View facility settings'),
  ('config', 'settings',   'write', 'Update facility settings'),
  ('config', 'department', 'read',  'View departments'),
  ('config', 'department', 'write', 'Manage departments'),
  ('config', 'ward',       'read',  'View wards and beds'),
  ('config', 'ward',       'write', 'Manage wards and beds'),
  ('config', 'staff',      'read',  'View staff roster'),
  ('config', 'staff',      'write', 'Invite and manage staff'),
  ('config', 'module',     'read',  'View module toggles'),
  ('config', 'module',     'write', 'Enable/disable modules'),
  ('config', 'service',    'read',  'View service catalog'),
  ('config', 'service',    'write', 'Manage service catalog'),
  ('config', 'audit',      'read',  'View audit log')
) AS v(module, resource, action, description)
WHERE NOT EXISTS (
  SELECT 1 FROM capabilities c
  WHERE c.module = v.module AND c.resource = v.resource AND c.action = v.action
);

-- ── Role capability grants (hospital facility type) ───────────────────────────
-- Helper: grant capability triple to role at facility_type
CREATE OR REPLACE FUNCTION _grant_hospital_cap(
  p_role text,
  p_facility_type text,
  p_module text,
  p_resource text,
  p_action text
) RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_cap_id uuid;
BEGIN
  SELECT id INTO v_cap_id
  FROM capabilities
  WHERE module = p_module AND resource = p_resource AND action = p_action
  LIMIT 1;

  IF v_cap_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO role_capabilities (role, facility_type, capability_id)
  VALUES (p_role, p_facility_type, v_cap_id)
  ON CONFLICT (role, facility_type, capability_id) DO NOTHING;
END;
$$;

-- Receptionist
SELECT _grant_hospital_cap('receptionist', 'hospital', 'registration', 'patient', 'register');
SELECT _grant_hospital_cap('receptionist', 'hospital', 'opd', 'queue', 'read');
SELECT _grant_hospital_cap('receptionist', 'hospital', 'opd', 'queue', 'write');
SELECT _grant_hospital_cap('receptionist', 'hospital', 'opd', 'encounter', 'create');

-- Nurse
SELECT _grant_hospital_cap('nurse', 'hospital', 'ward', 'bed', 'read');
SELECT _grant_hospital_cap('nurse', 'hospital', 'ward', 'bed', 'assign');
SELECT _grant_hospital_cap('nurse', 'hospital', 'ward', 'round', 'write');
SELECT _grant_hospital_cap('nurse', 'hospital', 'ipd', 'admission', 'read');
SELECT _grant_hospital_cap('nurse', 'hospital', 'emergency', 'triage', 'assign');

-- Doctor / clinical roles
SELECT _grant_hospital_cap('doctor', 'hospital', 'opd', 'encounter', 'create');
SELECT _grant_hospital_cap('doctor', 'hospital', 'opd', 'triage', 'assign');
SELECT _grant_hospital_cap('doctor', 'hospital', 'lab', 'order', 'create');
SELECT _grant_hospital_cap('doctor', 'hospital', 'radiology', 'order', 'create');
SELECT _grant_hospital_cap('doctor', 'hospital', 'ipd', 'admission', 'create');
SELECT _grant_hospital_cap('doctor', 'hospital', 'telemedicine', 'session', 'write');
SELECT _grant_hospital_cap('doctor', 'hospital', 'emergency', 'resus', 'document');

SELECT _grant_hospital_cap('clinical_officer', 'hospital', 'opd', 'encounter', 'create');
SELECT _grant_hospital_cap('clinical_officer', 'hospital', 'lab', 'order', 'create');

-- Lab
SELECT _grant_hospital_cap('lab_tech', 'hospital', 'lab', 'order', 'read');
SELECT _grant_hospital_cap('lab_tech', 'hospital', 'lab', 'order', 'create');
SELECT _grant_hospital_cap('lab_tech', 'hospital', 'lab', 'result', 'enter');
SELECT _grant_hospital_cap('lab_tech', 'hospital', 'lab', 'result', 'verify');

-- Radiology
SELECT _grant_hospital_cap('radiologist', 'hospital', 'radiology', 'report', 'verify');
SELECT _grant_hospital_cap('radiographer', 'hospital', 'radiology', 'order', 'read');
SELECT _grant_hospital_cap('radiographer', 'hospital', 'radiology', 'report', 'write');

-- Maternity / paediatrics specialists
SELECT _grant_hospital_cap('obstetrician', 'hospital', 'maternity', 'record', 'write');
SELECT _grant_hospital_cap('obstetrician', 'hospital', 'maternity', 'partograph', 'write');
SELECT _grant_hospital_cap('paediatrician', 'hospital', 'immunization', 'dose', 'administer');
SELECT _grant_hospital_cap('paediatrician', 'hospital', 'immunization', 'schedule', 'write');

-- Theatre
SELECT _grant_hospital_cap('surgeon', 'hospital', 'theatre', 'schedule', 'write');
SELECT _grant_hospital_cap('surgeon', 'hospital', 'theatre', 'checklist', 'verify');
SELECT _grant_hospital_cap('theatre_nurse', 'hospital', 'theatre', 'checklist', 'verify');
SELECT _grant_hospital_cap('anaesthetist', 'hospital', 'theatre', 'schedule', 'read');

-- Pharmacist (hospital dispensing — not POS)
SELECT _grant_hospital_cap('pharmacist', 'hospital', 'dispensing', 'order', 'fulfill');
SELECT _grant_hospital_cap('pharmacist', 'hospital', 'dispensing', 'inventory', 'read');

-- Billing / claims
SELECT _grant_hospital_cap('billing_officer', 'hospital', 'billing', 'invoice', 'create');
SELECT _grant_hospital_cap('billing_officer', 'hospital', 'billing', 'payment', 'record');
SELECT _grant_hospital_cap('claims_officer', 'hospital', 'claims', 'claim', 'submit');
SELECT _grant_hospital_cap('claims_officer', 'hospital', 'claims', 'preauth', 'draft');

-- Hospital admin (read-heavy + migration)
SELECT _grant_hospital_cap('hospital_admin', 'hospital', 'reports', 'generate', 'read');
SELECT _grant_hospital_cap('hospital_admin', 'hospital', 'reports', 'export', 'run');
SELECT _grant_hospital_cap('hospital_admin', 'hospital', 'migrate', 'import', 'run');
SELECT _grant_hospital_cap('hospital_admin', 'hospital', 'migrate', 'batch', 'admin');
SELECT _grant_hospital_cap('hospital_admin', 'hospital', 'hr', 'staff', 'read');
SELECT _grant_hospital_cap('hospital_admin', 'hospital', 'hr', 'attendance', 'record');

-- Mortuary / support (any facility)
SELECT _grant_hospital_cap('hospital_admin', 'any', 'mortuary', 'register', 'write');
SELECT _grant_hospital_cap('hospital_admin', 'any', 'mortuary', 'release', 'approve');
SELECT _grant_hospital_cap('hospital_admin', 'any', 'support', 'housekeeping', 'write');
SELECT _grant_hospital_cap('hospital_admin', 'any', 'support', 'visitor', 'write');

-- Public health (CHW + admin)
SELECT _grant_hospital_cap('chw', 'hospital', 'public_health', 'surveillance', 'report');
SELECT _grant_hospital_cap('hospital_admin', 'hospital', 'public_health', 'dhis2', 'export');

-- Hospital admin console (CONFIG)
SELECT _grant_hospital_cap('hospital_admin', 'hospital', 'config', 'settings',   'read');
SELECT _grant_hospital_cap('hospital_admin', 'hospital', 'config', 'settings',   'write');
SELECT _grant_hospital_cap('hospital_admin', 'hospital', 'config', 'department', 'read');
SELECT _grant_hospital_cap('hospital_admin', 'hospital', 'config', 'department', 'write');
SELECT _grant_hospital_cap('hospital_admin', 'hospital', 'config', 'ward',       'read');
SELECT _grant_hospital_cap('hospital_admin', 'hospital', 'config', 'ward',       'write');
SELECT _grant_hospital_cap('hospital_admin', 'hospital', 'config', 'staff',      'read');
SELECT _grant_hospital_cap('hospital_admin', 'hospital', 'config', 'staff',      'write');
SELECT _grant_hospital_cap('hospital_admin', 'hospital', 'config', 'module',     'read');
SELECT _grant_hospital_cap('hospital_admin', 'hospital', 'config', 'module',     'write');
SELECT _grant_hospital_cap('hospital_admin', 'hospital', 'config', 'service',    'read');
SELECT _grant_hospital_cap('hospital_admin', 'hospital', 'config', 'service',    'write');
SELECT _grant_hospital_cap('hospital_admin', 'hospital', 'config', 'audit',      'read');

-- Cleanup helper (not part of public API surface)
DROP FUNCTION IF EXISTS _grant_hospital_cap(text, text, text, text, text);
