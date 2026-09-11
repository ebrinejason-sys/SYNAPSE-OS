-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260612230501  name: capability_lattice_extension_phase2
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.


-- Phase 2: Capability lattice extension — additive only

-- ── New capabilities ────────────────────────────────────────────────────────

INSERT INTO capabilities (module, resource, action) VALUES
  ('subscription', 'plan',    'read'),
  ('subscription', 'plan',    'write'),
  ('subscription', 'billing', 'read'),
  ('subscription', 'billing', 'admin'),
  ('pos',          'sale',    'read'),
  ('pos',          'sale',    'write'),
  ('pos',          'refund',  'write'),
  ('pos',          'cashier', 'admin'),
  ('pos',          'cart',    'write'),
  ('pos',          'report',  'read'),
  ('insurance',    'policy',  'read'),
  ('insurance',    'claim',   'read'),
  ('insurance',    'claim',   'write'),
  ('insurance',    'preauth', 'read'),
  ('insurance',    'preauth', 'write'),
  ('insurance',    'copilot', 'read'),
  ('longitudinal', 'pattern', 'read'),
  ('longitudinal', 'context', 'read'),
  ('longitudinal', 'outcome', 'write')
ON CONFLICT (module, resource, action) DO NOTHING;

-- ── New role hierarchy ──────────────────────────────────────────────────────

INSERT INTO role_hierarchy (role, inherits) VALUES
  ('insurance_officer',      'claims_officer'),
  ('pharmacy_store_manager', 'pharmacist')
ON CONFLICT (role, inherits) DO NOTHING;

-- ── Helper: grant capability to role by module/resource/action ──────────────
-- Uses INSERT ... SELECT to resolve capability_id from capabilities table.

-- claims_officer: all insurance capabilities
INSERT INTO role_capabilities (role, facility_type, capability_id)
SELECT 'claims_officer', 'any', c.id
FROM capabilities c
WHERE c.module = 'insurance'
ON CONFLICT (role, facility_type, capability_id) DO NOTHING;

-- pharmacist: POS sale + cart + report
INSERT INTO role_capabilities (role, facility_type, capability_id)
SELECT 'pharmacist', 'any', c.id
FROM capabilities c
WHERE c.module = 'pos'
  AND (c.resource, c.action) IN (
    ('sale', 'read'), ('sale', 'write'), ('cart', 'write'), ('report', 'read')
  )
ON CONFLICT (role, facility_type, capability_id) DO NOTHING;

-- pharmacy_store_manager: refund + cashier admin
INSERT INTO role_capabilities (role, facility_type, capability_id)
SELECT 'pharmacy_store_manager', 'any', c.id
FROM capabilities c
WHERE c.module = 'pos'
  AND (c.resource, c.action) IN (
    ('refund', 'write'), ('cashier', 'admin')
  )
ON CONFLICT (role, facility_type, capability_id) DO NOTHING;

-- hospital_admin: subscription view + insurance view
INSERT INTO role_capabilities (role, facility_type, capability_id)
SELECT 'hospital_admin', 'any', c.id
FROM capabilities c
WHERE (c.module, c.resource, c.action) IN (
  ('subscription', 'plan',    'read'),
  ('subscription', 'billing', 'read'),
  ('insurance',    'policy',  'read'),
  ('insurance',    'claim',   'read')
)
ON CONFLICT (role, facility_type, capability_id) DO NOTHING;

-- doctor: insurance preauth+copilot + longitudinal
INSERT INTO role_capabilities (role, facility_type, capability_id)
SELECT 'doctor', 'any', c.id
FROM capabilities c
WHERE (c.module, c.resource, c.action) IN (
  ('insurance',    'preauth', 'read'),
  ('insurance',    'copilot', 'read'),
  ('longitudinal', 'pattern', 'read'),
  ('longitudinal', 'context', 'read'),
  ('longitudinal', 'outcome', 'write')
)
ON CONFLICT (role, facility_type, capability_id) DO NOTHING;

-- clinical_officer: insurance copilot + longitudinal context
INSERT INTO role_capabilities (role, facility_type, capability_id)
SELECT 'clinical_officer', 'any', c.id
FROM capabilities c
WHERE (c.module, c.resource, c.action) IN (
  ('insurance',    'preauth', 'read'),
  ('insurance',    'copilot', 'read'),
  ('longitudinal', 'context', 'read')
)
ON CONFLICT (role, facility_type, capability_id) DO NOTHING;

-- nurse: longitudinal pattern read
INSERT INTO role_capabilities (role, facility_type, capability_id)
SELECT 'nurse', 'any', c.id
FROM capabilities c
WHERE c.module = 'longitudinal' AND c.resource = 'pattern' AND c.action = 'read'
ON CONFLICT (role, facility_type, capability_id) DO NOTHING;
