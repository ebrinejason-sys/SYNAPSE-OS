-- Fix multitenant-incompatible global department name uniqueness.
-- Root cause: idx_departments_name_unique on lower(name) alone blocked
-- Hospital A and Hospital B from both having "Laboratory" / "Pharmacy" / "Billing".

DROP INDEX IF EXISTS public.idx_departments_name_unique;

-- Tenant-scoped uniqueness (normal facilities)
CREATE UNIQUE INDEX IF NOT EXISTS idx_departments_tenant_name_unique
  ON public.departments (tenant_id, lower(name))
  WHERE tenant_id IS NOT NULL;

-- Template/global rows (tenant_id IS NULL) keep their own uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS idx_departments_global_name_unique
  ON public.departments (lower(name))
  WHERE tenant_id IS NULL;

COMMENT ON INDEX public.idx_departments_tenant_name_unique IS
  'Department names unique per tenant. Hospital A and Hospital B may both have Laboratory.';
