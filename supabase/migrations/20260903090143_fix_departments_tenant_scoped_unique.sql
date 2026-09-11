-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260903090143  name: fix_departments_tenant_scoped_unique
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.

-- Fix multitenant-incompatible global department name uniqueness.
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
