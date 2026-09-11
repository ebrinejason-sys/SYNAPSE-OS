-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260504041852  name: demo_tables_in_public_schema
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.


-- Create demo_ prefixed tables in public schema matching exact demo schema structure
CREATE TABLE IF NOT EXISTS public.demo_departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.demo_patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mrn TEXT NOT NULL,
  full_name TEXT NOT NULL,
  dob DATE,
  sex TEXT,
  phone TEXT,
  nin TEXT,
  district TEXT,
  department_id UUID REFERENCES public.demo_departments(id),
  triage_status TEXT DEFAULT 'green',
  arrived_at TIMESTAMPTZ DEFAULT now(),
  is_deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.demo_encounters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES public.demo_patients(id) ON DELETE CASCADE,
  department_id UUID REFERENCES public.demo_departments(id),
  chief_complaint TEXT,
  diagnosis TEXT,
  notes TEXT,
  status TEXT DEFAULT 'open',
  doctor_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.demo_vitals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES public.demo_patients(id) ON DELETE CASCADE,
  encounter_id UUID REFERENCES public.demo_encounters(id),
  bp_systolic INT,
  bp_diastolic INT,
  heart_rate INT,
  temperature NUMERIC(4,1),
  spo2 INT,
  weight_kg NUMERIC(5,1),
  recorded_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.demo_encounter_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id UUID REFERENCES public.demo_encounters(id) ON DELETE CASCADE,
  order_type TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.demo_lab_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id UUID REFERENCES public.demo_encounters(id),
  patient_id UUID REFERENCES public.demo_patients(id),
  test_name TEXT NOT NULL,
  result_value TEXT,
  unit TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.demo_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demo_patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demo_encounters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demo_vitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demo_encounter_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demo_lab_results ENABLE ROW LEVEL SECURITY;

-- RLS: only the demo user can access these tables
CREATE POLICY "demo_depts_rls" ON public.demo_departments FOR ALL
  USING ((SELECT email FROM auth.users WHERE id = auth.uid()) = 'demo@synapseos.tech')
  WITH CHECK ((SELECT email FROM auth.users WHERE id = auth.uid()) = 'demo@synapseos.tech');

CREATE POLICY "demo_patients_rls" ON public.demo_patients FOR ALL
  USING ((SELECT email FROM auth.users WHERE id = auth.uid()) = 'demo@synapseos.tech')
  WITH CHECK ((SELECT email FROM auth.users WHERE id = auth.uid()) = 'demo@synapseos.tech');

CREATE POLICY "demo_encounters_rls" ON public.demo_encounters FOR ALL
  USING ((SELECT email FROM auth.users WHERE id = auth.uid()) = 'demo@synapseos.tech')
  WITH CHECK ((SELECT email FROM auth.users WHERE id = auth.uid()) = 'demo@synapseos.tech');

CREATE POLICY "demo_vitals_rls" ON public.demo_vitals FOR ALL
  USING ((SELECT email FROM auth.users WHERE id = auth.uid()) = 'demo@synapseos.tech')
  WITH CHECK ((SELECT email FROM auth.users WHERE id = auth.uid()) = 'demo@synapseos.tech');

CREATE POLICY "demo_orders_rls" ON public.demo_encounter_orders FOR ALL
  USING ((SELECT email FROM auth.users WHERE id = auth.uid()) = 'demo@synapseos.tech')
  WITH CHECK ((SELECT email FROM auth.users WHERE id = auth.uid()) = 'demo@synapseos.tech');

CREATE POLICY "demo_lab_results_rls" ON public.demo_lab_results FOR ALL
  USING ((SELECT email FROM auth.users WHERE id = auth.uid()) = 'demo@synapseos.tech')
  WITH CHECK ((SELECT email FROM auth.users WHERE id = auth.uid()) = 'demo@synapseos.tech');

-- Copy existing data from demo schema
INSERT INTO public.demo_departments (id, name, code, created_at)
  SELECT id, name, code, created_at FROM demo.departments ON CONFLICT (id) DO NOTHING;

INSERT INTO public.demo_patients (id, mrn, full_name, dob, sex, phone, nin, district, department_id, triage_status, arrived_at, is_deleted, created_at)
  SELECT id, mrn, full_name, dob, sex, phone, nin, district, department_id, triage_status, arrived_at, is_deleted, created_at FROM demo.patients ON CONFLICT (id) DO NOTHING;

INSERT INTO public.demo_encounters (id, patient_id, department_id, chief_complaint, diagnosis, notes, status, doctor_id, created_at, updated_at)
  SELECT id, patient_id, department_id, chief_complaint, diagnosis, notes, status, doctor_id, created_at, updated_at FROM demo.encounters ON CONFLICT (id) DO NOTHING;

INSERT INTO public.demo_vitals (id, patient_id, encounter_id, bp_systolic, bp_diastolic, heart_rate, temperature, spo2, weight_kg, recorded_at)
  SELECT id, patient_id, encounter_id, bp_systolic, bp_diastolic, heart_rate, temperature, spo2, weight_kg, recorded_at FROM demo.vitals ON CONFLICT (id) DO NOTHING;

INSERT INTO public.demo_encounter_orders (id, encounter_id, order_type, description, status, created_at)
  SELECT id, encounter_id, order_type, description, status, created_at FROM demo.encounter_orders ON CONFLICT (id) DO NOTHING;

INSERT INTO public.demo_lab_results (id, encounter_id, patient_id, test_name, result_value, unit, status, created_at)
  SELECT id, encounter_id, patient_id, test_name, result_value, unit, status, created_at FROM demo.lab_results ON CONFLICT (id) DO NOTHING;
