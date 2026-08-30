-- Emergency vertical slice capabilities (P1-011) — self-contained grants

INSERT INTO capabilities (module, resource, action, description)
SELECT v.module, v.resource, v.action, v.description
FROM (VALUES
  ('emergency', 'bay', 'assign', 'Assign ED bay or resuscitation room')
) AS v(module, resource, action, description)
WHERE NOT EXISTS (
  SELECT 1 FROM capabilities c
  WHERE c.module = v.module AND c.resource = v.resource AND c.action = v.action
);

INSERT INTO role_capabilities (role, facility_type, capability_id)
SELECT g.role, g.facility_type, c.id
FROM (VALUES
  ('nurse',            'hospital', 'emergency', 'triage', 'assign'),
  ('doctor',           'hospital', 'emergency', 'triage', 'assign'),
  ('clinical_officer', 'hospital', 'emergency', 'triage', 'assign'),
  ('nurse',            'hospital', 'emergency', 'bay',    'assign'),
  ('doctor',           'hospital', 'emergency', 'bay',    'assign')
) AS g(role, facility_type, module, resource, action)
JOIN capabilities c
  ON c.module = g.module AND c.resource = g.resource AND c.action = g.action
ON CONFLICT (role, facility_type, capability_id) DO NOTHING;
