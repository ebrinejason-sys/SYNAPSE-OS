-- has_capability: role-based capability gate
-- Called by packages/auth/src/capability.ts via supabase.rpc('has_capability', {...})
-- Joins role_capabilities (role + facility_type + capability_id) with
-- capabilities (module + resource + action) to evaluate permission.
-- platform_admin bypasses this check in application code (capability.ts:22).

CREATE OR REPLACE FUNCTION has_capability(
  p_role           text,
  p_facility_type  text,
  p_module         text,
  p_resource       text,
  p_action         text
) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM role_capabilities rc
    JOIN capabilities c ON c.id = rc.capability_id
    WHERE rc.role = p_role
      AND c.module = p_module
      AND c.resource = p_resource
      AND c.action = p_action
      AND (rc.facility_type = p_facility_type OR rc.facility_type = 'any')
  );
$$;
