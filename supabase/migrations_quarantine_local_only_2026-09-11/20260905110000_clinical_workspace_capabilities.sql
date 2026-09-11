-- Clinical workspace guards: signing is distinct from creating an encounter.
INSERT INTO public.capabilities (module, resource, action, description)
VALUES ('opd', 'encounter', 'sign', 'Sign an OPD encounter')
ON CONFLICT (module, resource, action) DO NOTHING;

INSERT INTO public.role_capabilities (role, facility_type, capability_id)
SELECT roles.role, 'hospital', capabilities.id
FROM (VALUES ('doctor'), ('clinical_officer')) AS roles(role)
JOIN public.capabilities
  ON capabilities.module = 'opd'
 AND capabilities.resource = 'encounter'
 AND capabilities.action = 'sign'
ON CONFLICT (role, facility_type, capability_id) DO NOTHING;