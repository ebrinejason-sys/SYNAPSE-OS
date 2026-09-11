-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260613104631  name: emergency_auth_rls_convergence
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.

-- Emergency auth/RLS convergence.
-- Fixes recursive profile policies that can make PostgREST return 500 on
-- simple profile reads, and ensures helper functions use a stable search_path.

CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT tenant_id FROM profiles WHERE id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION current_hospital_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT hospital_id FROM profiles WHERE id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION is_platform_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'platform_admin'
  );
$$;

CREATE OR REPLACE FUNCTION is_clinical_staff()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role IN (
        'doctor',
        'nurse',
        'clinical_officer',
        'radiologist',
        'lab_tech',
        'lab_supervisor',
        'pharmacist',
        'hospital_admin',
        'facility_admin',
        'admin'
      )
  );
$$;

REVOKE ALL ON FUNCTION current_tenant_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION current_hospital_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION is_platform_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION is_clinical_staff() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION current_tenant_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION current_hospital_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION is_platform_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION is_clinical_staff() TO authenticated, service_role;

DO $$
DECLARE
  policy_record RECORD;
BEGIN
  FOR policy_record IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', policy_record.policyname);
  END LOOP;
END $$;

CREATE POLICY profiles_select_identity_or_tenant
ON profiles
FOR SELECT
USING (
  id = auth.uid()
  OR is_platform_admin()
  OR (tenant_id IS NOT NULL AND tenant_id = current_tenant_id())
  OR (hospital_id IS NOT NULL AND hospital_id = current_hospital_id())
);

CREATE POLICY profiles_insert_own_or_platform
ON profiles
FOR INSERT
WITH CHECK (
  id = auth.uid()
  OR is_platform_admin()
);

CREATE POLICY profiles_update_own_or_platform
ON profiles
FOR UPDATE
USING (
  id = auth.uid()
  OR is_platform_admin()
)
WITH CHECK (
  id = auth.uid()
  OR is_platform_admin()
);

CREATE POLICY profiles_delete_platform_only
ON profiles
FOR DELETE
USING (is_platform_admin());

DO $$
DECLARE
  policy_record RECORD;
BEGIN
  FOR policy_record IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'patient_profiles'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.patient_profiles', policy_record.policyname);
  END LOOP;
END $$;

CREATE POLICY patient_profiles_select_identity_or_care_team
ON patient_profiles
FOR SELECT
USING (
  id = auth.uid()
  OR is_platform_admin()
  OR (
    hospital_id IS NOT NULL
    AND hospital_id = current_hospital_id()
    AND is_clinical_staff()
  )
);

CREATE POLICY patient_profiles_insert_own_or_platform
ON patient_profiles
FOR INSERT
WITH CHECK (
  id = auth.uid()
  OR is_platform_admin()
);

CREATE POLICY patient_profiles_update_own_or_platform
ON patient_profiles
FOR UPDATE
USING (
  id = auth.uid()
  OR is_platform_admin()
)
WITH CHECK (
  id = auth.uid()
  OR is_platform_admin()
);

CREATE POLICY patient_profiles_delete_platform_only
ON patient_profiles
FOR DELETE
USING (is_platform_admin());
