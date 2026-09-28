-- Rollback: remove only the grants added by up.sql. Capability rows are kept
-- (other environments/tests may reference them; they grant nothing on their own).
BEGIN;
DELETE FROM public.role_capabilities rc
USING public.capabilities c
WHERE rc.capability_id = c.id
  AND rc.role = 'doctor' AND rc.facility_type = 'hospital'
  AND c.module = 'opd' AND c.resource = 'encounter' AND c.action IN ('sign', 'disposition');
COMMIT;
