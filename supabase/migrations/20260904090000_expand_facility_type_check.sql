-- Keep the tenant type constraint aligned with the Platform Admin facility catalog.
ALTER TABLE public.tenants
  DROP CONSTRAINT IF EXISTS tenants_facility_type_check;

ALTER TABLE public.tenants
  ADD CONSTRAINT tenants_facility_type_check
  CHECK (facility_type IN (
    'hospital',
    'clinic',
    'health_centre',
    'pharmacy',
    'laboratory',
    'lab',
    'imaging_center',
    'dental',
    'mental_health'
  ));