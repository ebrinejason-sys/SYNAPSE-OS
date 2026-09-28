-- Rollback: remove only the grants added by up.sql. Capability rows are kept
-- (other environments/tests may reference them; they grant nothing on their own).
-- The nurse grants are removed only where up.sql could have added them; an
-- environment that already granted them before up.sql should skip that block.
BEGIN;
DELETE FROM public.role_capabilities rc
USING public.capabilities c
WHERE rc.capability_id = c.id
  AND rc.role IN ('doctor', 'clinical_officer') AND rc.facility_type = 'hospital'
  AND c.module = 'opd'
  AND (c.resource, c.action) IN (
    ('encounter', 'sign'), ('encounter', 'disposition'), ('encounter', 'close'),
    ('result', 'review'), ('prescription', 'cancel')
  );

DELETE FROM public.role_capabilities rc
USING public.capabilities c
WHERE rc.capability_id = c.id
  AND rc.role = 'nurse' AND rc.facility_type = 'hospital'
  AND c.module = 'opd'
  AND (c.resource, c.action) IN (('triage', 'assign'), ('queue', 'read'));
COMMIT;
