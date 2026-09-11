-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260615112752  name: add_pharmacy_admin_role
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.


-- Add pharmacy_admin to the profiles role CHECK constraint
ALTER TABLE public.profiles
  DROP CONSTRAINT profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check CHECK (role = ANY (ARRAY[
    'clinician','admin','doctor','nurse','pharmacist','receptionist',
    'lab_technician','radiographer','billing_officer','patient',
    'superadmin','hospital_admin','super_admin','overall_admin',
    'platform_admin','specialist','surgeon','anaesthetist','intensivist',
    'cardiologist','oncologist','psychiatrist','nephrologist',
    'hiv_counselor','art_clinician','obstetrician','paediatrician',
    'theatre_nurse','icu_nurse','chw','social_worker',
    'pharmacy_admin'
  ]));
