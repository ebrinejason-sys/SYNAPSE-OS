-- Allow platform_observer profile role for control-plane-only users (no tenant scope).
-- Authorization is enforced via platform_memberships, not profiles.role alone.

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check CHECK (role = ANY (ARRAY[
    'clinician','admin','doctor','nurse','pharmacist','receptionist',
    'lab_technician','radiographer','billing_officer','patient',
    'superadmin','hospital_admin','super_admin','overall_admin',
    'platform_admin','platform_observer','specialist','surgeon','anaesthetist','intensivist',
    'cardiologist','oncologist','psychiatrist','nephrologist',
    'hiv_counselor','art_clinician','obstetrician','paediatrician',
    'theatre_nurse','icu_nurse','chw','social_worker',
    'pharmacy_admin'
  ]));
