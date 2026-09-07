-- Align standalone and hospital laboratory roles with the Lab API capability checks.
INSERT INTO public.role_capabilities (role, facility_type, capability_id)
SELECT grants.role, grants.facility_type, c.id
FROM (VALUES
  ('lab_admin', 'laboratory', 'lab', 'order', 'read'),
  ('lab_admin', 'laboratory', 'lab', 'order', 'create'),
  ('lab_admin', 'laboratory', 'lab', 'specimen', 'collect'),
  ('lab_admin', 'laboratory', 'lab', 'result', 'read'),
  ('lab_admin', 'laboratory', 'lab', 'result', 'enter'),
  ('lab_admin', 'laboratory', 'lab', 'result', 'verify'),
  ('lab_scientist', 'laboratory', 'lab', 'order', 'create'),
  ('lab_technician', 'laboratory', 'lab', 'order', 'create'),
  ('lab_admin', 'hospital', 'lab', 'order', 'read'),
  ('lab_admin', 'hospital', 'lab', 'order', 'create'),
  ('lab_admin', 'hospital', 'lab', 'specimen', 'collect'),
  ('lab_admin', 'hospital', 'lab', 'result', 'read'),
  ('lab_admin', 'hospital', 'lab', 'result', 'enter'),
  ('lab_admin', 'hospital', 'lab', 'result', 'verify'),
  ('lab_scientist', 'hospital', 'lab', 'order', 'read'),
  ('lab_scientist', 'hospital', 'lab', 'order', 'create'),
  ('lab_scientist', 'hospital', 'lab', 'specimen', 'collect'),
  ('lab_scientist', 'hospital', 'lab', 'result', 'read'),
  ('lab_scientist', 'hospital', 'lab', 'result', 'enter'),
  ('lab_scientist', 'hospital', 'lab', 'result', 'verify'),
  ('lab_technician', 'hospital', 'lab', 'order', 'read'),
  ('lab_technician', 'hospital', 'lab', 'order', 'create'),
  ('lab_technician', 'hospital', 'lab', 'specimen', 'collect'),
  ('lab_technician', 'hospital', 'lab', 'result', 'read'),
  ('lab_technician', 'hospital', 'lab', 'result', 'enter'),
  ('lab_tech', 'hospital', 'lab', 'specimen', 'collect'),
  ('lab_tech', 'hospital', 'lab', 'result', 'read')
) AS grants(role, facility_type, module, resource, action)
JOIN public.capabilities c
  ON c.module = grants.module AND c.resource = grants.resource AND c.action = grants.action
ON CONFLICT (role, facility_type, capability_id) DO NOTHING;
