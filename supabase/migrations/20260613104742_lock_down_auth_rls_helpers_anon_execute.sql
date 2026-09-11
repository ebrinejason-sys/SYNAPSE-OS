-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260613104742  name: lock_down_auth_rls_helpers_anon_execute
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.

REVOKE ALL ON FUNCTION current_tenant_id() FROM anon;
REVOKE ALL ON FUNCTION current_hospital_id() FROM anon;
REVOKE ALL ON FUNCTION is_platform_admin() FROM anon;
REVOKE ALL ON FUNCTION is_clinical_staff() FROM anon;
