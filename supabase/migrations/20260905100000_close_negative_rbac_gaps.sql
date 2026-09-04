-- P0-RBAC: remove the lab technician verifier grant.
-- Technicians enter results; lab scientists/verifiers review and release them.
DELETE FROM public.role_capabilities rc
USING public.capabilities c
WHERE rc.capability_id = c.id
  AND rc.role = 'lab_tech'
  AND rc.facility_type = 'hospital'
  AND c.module = 'lab'
  AND c.resource = 'result'
  AND c.action = 'verify';