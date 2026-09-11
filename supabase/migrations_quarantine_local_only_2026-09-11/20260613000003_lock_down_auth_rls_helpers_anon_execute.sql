-- Keep auth/RLS helper predicates callable by authenticated users for policies,
-- but do not expose them as anonymous RPC functions.

REVOKE ALL ON FUNCTION current_tenant_id() FROM anon;
REVOKE ALL ON FUNCTION current_hospital_id() FROM anon;
REVOKE ALL ON FUNCTION is_platform_admin() FROM anon;
REVOKE ALL ON FUNCTION is_clinical_staff() FROM anon;
