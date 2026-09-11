-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260503175422  name: create_demo_schema
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.

-- Create demo schema
CREATE SCHEMA IF NOT EXISTS demo;

-- Grant usage on demo schema to authenticated role
GRANT USAGE ON SCHEMA demo TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA demo TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA demo GRANT ALL ON TABLES TO authenticated;

-- demo.profiles
CREATE TABLE demo.profiles (
  id uuid PRIMARY KEY,
  full_name text,
  role text NOT NULL DEFAULT 'doctor',
  is_demo boolean NOT NULL DEFAULT true,
  hospital_id uuid,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

-- demo.departments
CREATE TABLE demo.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

-- demo.patients
CREATE TABLE demo.patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mrn text NOT NULL UNIQUE,
  full_name text NOT NULL,
  dob date,
  sex text,
  phone text,
  nin text,
  district text,
  department_id uuid REFERENCES demo.departments(id),
  triage_status text NOT NULL DEFAULT 'green',
  arrived_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

-- demo.encounters
CREATE TABLE demo.encounters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES demo.patients(id),
  department_id uuid REFERENCES demo.departments(id),
  chief_complaint text,
  diagnosis text,
  notes text,
  status text NOT NULL DEFAULT 'open',
  doctor_id uuid,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

-- demo.vitals
CREATE TABLE demo.vitals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES demo.patients(id),
  encounter_id uuid REFERENCES demo.encounters(id),
  bp_systolic integer,
  bp_diastolic integer,
  heart_rate integer,
  temperature numeric(4,1),
  spo2 integer,
  weight_kg numeric(5,1),
  recorded_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

-- demo.encounter_orders
CREATE TABLE demo.encounter_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id uuid NOT NULL REFERENCES demo.encounters(id),
  order_type text NOT NULL DEFAULT 'lab',
  description text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

-- demo.lab_results
CREATE TABLE demo.lab_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES demo.patients(id),
  encounter_id uuid REFERENCES demo.encounters(id),
  test_name text NOT NULL,
  result_value text,
  unit text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

-- RLS: enable on all demo tables
ALTER TABLE demo.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE demo.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE demo.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE demo.encounters ENABLE ROW LEVEL SECURITY;
ALTER TABLE demo.vitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE demo.encounter_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE demo.lab_results ENABLE ROW LEVEL SECURITY;

-- RLS policies: only demo users can access demo tables
CREATE POLICY "demo_users_only" ON demo.profiles
  FOR ALL USING (auth.uid() = id AND is_demo = true);

CREATE POLICY "demo_users_read_departments" ON demo.departments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM demo.profiles WHERE id = auth.uid() AND is_demo = true)
  );

CREATE POLICY "demo_users_all_patients" ON demo.patients
  FOR ALL USING (
    EXISTS (SELECT 1 FROM demo.profiles WHERE id = auth.uid() AND is_demo = true)
  );

CREATE POLICY "demo_users_all_encounters" ON demo.encounters
  FOR ALL USING (
    EXISTS (SELECT 1 FROM demo.profiles WHERE id = auth.uid() AND is_demo = true)
  );

CREATE POLICY "demo_users_all_vitals" ON demo.vitals
  FOR ALL USING (
    EXISTS (SELECT 1 FROM demo.profiles WHERE id = auth.uid() AND is_demo = true)
  );

CREATE POLICY "demo_users_all_orders" ON demo.encounter_orders
  FOR ALL USING (
    EXISTS (SELECT 1 FROM demo.profiles WHERE id = auth.uid() AND is_demo = true)
  );

CREATE POLICY "demo_users_all_lab_results" ON demo.lab_results
  FOR ALL USING (
    EXISTS (SELECT 1 FROM demo.profiles WHERE id = auth.uid() AND is_demo = true)
  );
