-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260613072631  name: has_capability_function
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.

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
