-- Scoped standalone laboratory access. Clinical release remains a scientist capability.
INSERT INTO public.capabilities (module, resource, action, description)
SELECT v.module, v.resource, v.action, v.description
FROM (VALUES
  ('lab', 'order', 'read', 'Read facility laboratory orders'),
  ('lab', 'specimen', 'collect', 'Collect facility laboratory specimens'),
  ('lab', 'result', 'read', 'Read facility laboratory results'),
  ('lab', 'result', 'enter', 'Enter facility laboratory results'),
  ('lab', 'result', 'verify', 'Independently verify laboratory results'),
  ('config', 'staff', 'read', 'Read facility staff'),
  ('config', 'staff', 'write', 'Manage facility staff')
) AS v(module, resource, action, description)
WHERE NOT EXISTS (SELECT 1 FROM public.capabilities c WHERE c.module=v.module AND c.resource=v.resource AND c.action=v.action);

INSERT INTO public.role_capabilities (role, facility_type, capability_id)
SELECT g.role, 'laboratory', c.id
FROM (VALUES
  ('lab_admin', 'lab', 'order', 'read'),
  ('lab_admin', 'lab', 'result', 'read'),
  ('lab_admin', 'config', 'staff', 'read'),
  ('lab_admin', 'config', 'staff', 'write'),
  ('lab_scientist', 'lab', 'order', 'read'),
  ('lab_scientist', 'lab', 'specimen', 'collect'),
  ('lab_scientist', 'lab', 'result', 'read'),
  ('lab_scientist', 'lab', 'result', 'enter'),
  ('lab_scientist', 'lab', 'result', 'verify'),
  ('lab_technician', 'lab', 'order', 'read'),
  ('lab_technician', 'lab', 'specimen', 'collect'),
  ('lab_technician', 'lab', 'result', 'read'),
  ('lab_technician', 'lab', 'result', 'enter')
) AS g(role,module,resource,action)
JOIN public.capabilities c ON c.module=g.module AND c.resource=g.resource AND c.action=g.action
ON CONFLICT (role,facility_type,capability_id) DO NOTHING;
