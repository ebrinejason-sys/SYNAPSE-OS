-- Rollback: remove only the grants added by up.sql. Capability rows are kept
-- (other environments/tests may reference them; they grant nothing on their own).
-- The read and nurse grants use pre-existing capabilities; an environment that
-- already granted them before up.sql should skip the matching block.
BEGIN;
DELETE FROM public.role_capabilities rc
USING public.capabilities c
WHERE rc.capability_id = c.id
  AND rc.role IN ('doctor', 'clinical_officer') AND rc.facility_type = 'hospital'
  AND (c.module, c.resource, c.action) IN (
    ('opd', 'encounter', 'sign'), ('opd', 'encounter', 'disposition'), ('opd', 'encounter', 'close'),
    ('opd', 'result', 'review'), ('opd', 'prescription', 'cancel'),
    ('opd', 'queue', 'read'), ('lab', 'order', 'read')
  );

DELETE FROM public.role_capabilities rc
USING public.capabilities c
WHERE rc.capability_id = c.id
  AND rc.role = 'nurse' AND rc.facility_type = 'hospital'
  AND (c.module, c.resource, c.action) IN (('opd', 'triage', 'assign'), ('opd', 'queue', 'read'));
COMMIT;
