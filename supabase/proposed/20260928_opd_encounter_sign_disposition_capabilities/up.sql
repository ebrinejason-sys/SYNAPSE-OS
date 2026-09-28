-- PROPOSED SEED — NOT an auto-applied migration (lives under supabase/proposed/).
--
-- These routes require capabilities that no migration ever created, so
-- has_capability() is false for every role and they return 403 in production:
--   POST /api/opd/encounters/[id]/sign         opd.encounter.sign
--   POST /api/opd/encounters/[id]/disposition  opd.encounter.disposition
--   POST /api/opd/encounters/[id]/close        opd.encounter.close
--   POST /api/opd/results/[resultId]/review    opd.result.review
--   POST /api/opd/prescriptions/[id]/cancel    opd.prescription.cancel
--
-- Clinician grants (doctor, clinical_officer): sign, disposition, close,
-- result review, prescription cancel. Reception and nursing are not granted.
--
-- Nursing grants (nurse): opd.triage.assign and opd.queue.read, both existing
-- capabilities. Outpatient triage/vitals is nursing work; production grants
-- opd.triage.assign to doctor only.
--
-- Idempotent (ON CONFLICT DO NOTHING). Catalogue-only: never touches tenants,
-- profiles or tenant data.
BEGIN;

INSERT INTO public.capabilities (module, resource, action, description) VALUES
  ('opd', 'encounter',    'sign',        'Sign OPD encounter'),
  ('opd', 'encounter',    'disposition', 'Record OPD encounter disposition'),
  ('opd', 'encounter',    'close',       'Close OPD encounter'),
  ('opd', 'result',       'review',      'Review OPD lab result'),
  ('opd', 'prescription', 'cancel',      'Cancel OPD prescription')
ON CONFLICT (module, resource, action) DO NOTHING;

INSERT INTO public.role_capabilities (role, facility_type, capability_id)
SELECT g.role, g.facility_type, c.id
FROM (VALUES
  ('doctor', 'hospital', 'opd', 'encounter', 'sign'),
  ('doctor', 'hospital', 'opd', 'encounter', 'disposition'),
  ('doctor', 'hospital', 'opd', 'encounter', 'close'),
  ('doctor', 'hospital', 'opd', 'result', 'review'),
  ('doctor', 'hospital', 'opd', 'prescription', 'cancel'),
  ('clinical_officer', 'hospital', 'opd', 'encounter', 'sign'),
  ('clinical_officer', 'hospital', 'opd', 'encounter', 'disposition'),
  ('clinical_officer', 'hospital', 'opd', 'encounter', 'close'),
  ('clinical_officer', 'hospital', 'opd', 'result', 'review'),
  ('clinical_officer', 'hospital', 'opd', 'prescription', 'cancel'),
  ('nurse', 'hospital', 'opd', 'triage', 'assign'),
  ('nurse', 'hospital', 'opd', 'queue', 'read')
) AS g(role, facility_type, module, resource, action)
JOIN public.capabilities c
  ON c.module = g.module AND c.resource = g.resource AND c.action = g.action
ON CONFLICT (role, facility_type, capability_id) DO NOTHING;

COMMIT;
