-- PROPOSED SEED — NOT an auto-applied migration (lives under supabase/proposed/).
--
-- POST /api/opd/encounters/[id]/sign        requires opd.encounter.sign
-- POST /api/opd/encounters/[id]/disposition requires opd.encounter.disposition
-- No migration ever created these capabilities, so has_capability() is false
-- for every role and both routes return 403 in production.
--
-- Grants are limited to what the repo already defines:
--   * opd.encounter.sign        -> doctor  (scripts/e2e-os-capability-lattice.ts,
--                                           "documented OPD sign grant")
--   * opd.encounter.disposition -> doctor  (the route records "Doctor disposition recorded")
-- clinical_officer is NOT granted here: product decision required.
--
-- Idempotent (ON CONFLICT DO NOTHING). Catalogue-only: never touches tenants,
-- profiles or tenant data.
BEGIN;

INSERT INTO public.capabilities (module, resource, action, description) VALUES
  ('opd', 'encounter', 'sign',        'Sign OPD encounter'),
  ('opd', 'encounter', 'disposition', 'Record OPD encounter disposition')
ON CONFLICT (module, resource, action) DO NOTHING;

INSERT INTO public.role_capabilities (role, facility_type, capability_id)
SELECT g.role, g.facility_type, c.id
FROM (VALUES
  ('doctor', 'hospital', 'opd', 'encounter', 'sign'),
  ('doctor', 'hospital', 'opd', 'encounter', 'disposition')
) AS g(role, facility_type, module, resource, action)
JOIN public.capabilities c
  ON c.module = g.module AND c.resource = g.resource AND c.action = g.action
ON CONFLICT (role, facility_type, capability_id) DO NOTHING;

COMMIT;
