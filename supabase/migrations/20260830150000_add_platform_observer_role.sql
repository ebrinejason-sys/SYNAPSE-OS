-- Expand profiles.role check to include platform_observer and roles already present in production data.
-- Control-plane authorization remains on platform_memberships; profiles.role is identity routing only.

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check CHECK (role = ANY (ARRAY[
    'clinician','admin','doctor','nurse','pharmacist','receptionist',
    'lab_technician','lab_scientist','lab_admin','radiographer','radiologist','imaging_admin',
    'billing_officer','insurance_officer','patient',
    'superadmin','hospital_admin','super_admin','overall_admin',
    'platform_admin','platform_observer',
    'clinical_officer',
    'specialist','surgeon','anaesthetist','intensivist',
    'cardiologist','oncologist','psychiatrist','nephrologist',
    'hiv_counselor','art_clinician','obstetrician','paediatrician',
    'theatre_nurse','icu_nurse','chw','social_worker',
    'pharmacy_admin','pharmacy_staff','pharmacy_cashier','pharmacy_store_manager'
  ]));
