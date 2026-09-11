-- Add pharmacy_admin to the profiles role CHECK constraint.
-- The original constraint was missing this role, causing pharmacy profile
-- inserts to fail silently during provisioning.
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
