-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260503150842  name: extend_profiles_role_enum_superadmin
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.


ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check CHECK (
    role = ANY (ARRAY[
      'clinician', 'admin', 'doctor', 'nurse', 'pharmacist',
      'receptionist', 'lab_technician', 'radiographer', 'billing_officer',
      'patient', 'superadmin', 'hospital_admin', 'super_admin',
      'overall_admin', 'platform_admin', 'specialist', 'surgeon',
      'anaesthetist', 'intensivist', 'cardiologist', 'oncologist',
      'psychiatrist', 'nephrologist', 'hiv_counselor', 'art_clinician',
      'obstetrician', 'paediatrician', 'theatre_nurse', 'icu_nurse',
      'chw', 'social_worker'
    ])
  );
