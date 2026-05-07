-- Create DEMO schema for Synapse
CREATE SCHEMA IF NOT EXISTS demo;

-- Facilities
CREATE TABLE demo.facilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schema TEXT DEFAULT 'demo',
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  country TEXT DEFAULT 'Uganda',
  region TEXT,
  district TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  website TEXT,
  established_year INTEGER,
  facility_type TEXT DEFAULT 'Hospital',
  bed_capacity INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Patients
CREATE TABLE demo.patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schema TEXT DEFAULT 'demo',
  facility_id UUID REFERENCES demo.facilities(id),
  mrn TEXT UNIQUE NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  date_of_birth DATE,
  gender TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  insurance_provider TEXT,
  insurance_number TEXT,
  blood_type TEXT,
  allergies TEXT,
  comorbidities TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Encounters
CREATE TABLE demo.encounters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schema TEXT DEFAULT 'demo',
  facility_id UUID REFERENCES demo.facilities(id),
  patient_id UUID REFERENCES demo.patients(id),
  encounter_type TEXT DEFAULT 'OPD',
  status TEXT DEFAULT 'active',
  acuity_level TEXT DEFAULT 'Green',
  visit_reason TEXT,
  temperature DECIMAL(5,2),
  blood_pressure TEXT,
  heart_rate INTEGER,
  respiratory_rate INTEGER,
  oxygen_saturation DECIMAL(5,2),
  weight DECIMAL(7,2),
  height DECIMAL(7,2),
  bmi DECIMAL(5,2),
  chief_complaint TEXT,
  history_of_presenting_illness TEXT,
  clinical_notes TEXT,
  assessment TEXT,
  plan TEXT,
  doctor_name TEXT,
  doctor_id UUID,
  is_signed BOOLEAN DEFAULT false,
  signed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Encounter Diagnoses
CREATE TABLE demo.encounter_diagnoses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schema TEXT DEFAULT 'demo',
  encounter_id UUID REFERENCES demo.encounters(id) ON DELETE CASCADE,
  icd11_code TEXT,
  diagnosis_text TEXT NOT NULL,
  certainty TEXT DEFAULT 'presumptive',
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Observations (Vitals, Lab Results, etc.)
CREATE TABLE demo.observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schema TEXT DEFAULT 'demo',
  encounter_id UUID REFERENCES demo.encounters(id) ON DELETE CASCADE,
  patient_id UUID REFERENCES demo.patients(id),
  observation_type TEXT NOT NULL,
  value TEXT,
  unit TEXT,
  status TEXT DEFAULT 'final',
  reference_range TEXT,
  is_critical BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Lab Orders
CREATE TABLE demo.lab_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schema TEXT DEFAULT 'demo',
  facility_id UUID REFERENCES demo.facilities(id),
  encounter_id UUID REFERENCES demo.encounters(id),
  patient_id UUID REFERENCES demo.patients(id),
  test_name TEXT NOT NULL,
  urgency TEXT DEFAULT 'routine',
  status TEXT DEFAULT 'pending',
  ordered_by TEXT,
  ordered_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  collected_at TIMESTAMP WITH TIME ZONE,
  resulted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Lab Results
CREATE TABLE demo.lab_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schema TEXT DEFAULT 'demo',
  lab_order_id UUID REFERENCES demo.lab_orders(id) ON DELETE CASCADE,
  test_name TEXT NOT NULL,
  result_value TEXT,
  unit TEXT,
  reference_range TEXT,
  is_critical BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Pharmacy Orders
CREATE TABLE demo.pharmacy_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schema TEXT DEFAULT 'demo',
  facility_id UUID REFERENCES demo.facilities(id),
  encounter_id UUID REFERENCES demo.encounters(id),
  patient_id UUID REFERENCES demo.patients(id),
  status TEXT DEFAULT 'pending',
  total_cost DECIMAL(10,2),
  paid_amount DECIMAL(10,2) DEFAULT 0,
  insurance_covered DECIMAL(10,2),
  patient_copay DECIMAL(10,2),
  prescribed_by TEXT,
  dispensed_by TEXT,
  dispensed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Pharmacy Order Items
CREATE TABLE demo.pharmacy_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schema TEXT DEFAULT 'demo',
  pharmacy_order_id UUID REFERENCES demo.pharmacy_orders(id) ON DELETE CASCADE,
  medication_name TEXT NOT NULL,
  strength TEXT,
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10,2),
  total_price DECIMAL(10,2),
  dosage TEXT,
  frequency TEXT,
  duration_days INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Clinical Guidelines
CREATE TABLE demo.clinical_guidelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schema TEXT DEFAULT 'demo',
  condition TEXT NOT NULL,
  icd11_code TEXT,
  guideline_text TEXT,
  recommendations TEXT,
  version TEXT DEFAULT '1.0',
  ucg_citation TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Insurance Providers
CREATE TABLE demo.insurance_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schema TEXT DEFAULT 'demo',
  facility_id UUID REFERENCES demo.facilities(id),
  name TEXT NOT NULL,
  code TEXT UNIQUE,
  website TEXT,
  phone TEXT,
  email TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Orders (generic for lab, pharmacy, imaging, etc.)
CREATE TABLE demo.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schema TEXT DEFAULT 'demo',
  encounter_id UUID REFERENCES demo.encounters(id),
  patient_id UUID REFERENCES demo.patients(id),
  order_type TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_facilities_schema ON demo.facilities(schema);
CREATE INDEX idx_patients_schema_facility ON demo.patients(schema, facility_id);
CREATE INDEX idx_encounters_schema_facility ON demo.encounters(schema, facility_id);
CREATE INDEX idx_encounters_patient ON demo.encounters(patient_id);
CREATE INDEX idx_encounters_status ON demo.encounters(status, acuity_level);
CREATE INDEX idx_lab_orders_facility ON demo.lab_orders(facility_id);
CREATE INDEX idx_lab_orders_status ON demo.lab_orders(status);
CREATE INDEX idx_pharmacy_orders_facility ON demo.pharmacy_orders(facility_id);
CREATE INDEX idx_pharmacy_orders_status ON demo.pharmacy_orders(status);
CREATE INDEX idx_guidelines_condition ON demo.clinical_guidelines(condition);

-- Seed Demo Data
-- Insert Facility (Mengo Hospital)
INSERT INTO demo.facilities (name, slug, country, region, district, phone, email, address, established_year, facility_type, bed_capacity)
VALUES (
  'Mengo Hospital',
  'mengo',
  'Uganda',
  'Central',
  'Kampala',
  '+256 414 286 900',
  'info@mengohospital.ug',
  'Plot 123, Old Kampala Road, Kampala',
  1995,
  'Hospital',
  500
)
ON CONFLICT DO NOTHING;

-- Insert Demo Patients
INSERT INTO demo.patients (facility_id, mrn, first_name, last_name, date_of_birth, gender, phone, email, blood_type, allergies)
SELECT 
  f.id,
  'MHO-2026-001',
  'James',
  'Kamugisha',
  '1985-03-15'::DATE,
  'Male',
  '+256 702 123 456',
  'james.kamugisha@email.com',
  'O+',
  'Penicillin'
FROM demo.facilities f WHERE f.slug = 'mengo'
ON CONFLICT DO NOTHING;

INSERT INTO demo.patients (facility_id, mrn, first_name, last_name, date_of_birth, gender, phone, email, blood_type, allergies)
SELECT 
  f.id,
  'MHO-2026-002',
  'Grace',
  'Nabwire',
  '1992-07-22'::DATE,
  'Female',
  '+256 703 456 789',
  'grace.nabwire@email.com',
  'A+',
  'None'
FROM demo.facilities f WHERE f.slug = 'mengo'
ON CONFLICT DO NOTHING;

INSERT INTO demo.patients (facility_id, mrn, first_name, last_name, date_of_birth, gender, phone, email, blood_type, allergies)
SELECT 
  f.id,
  'MHO-2026-003',
  'Okello',
  'Moses',
  '1978-11-08'::DATE,
  'Male',
  '+256 704 789 012',
  'okello.moses@email.com',
  'B+',
  'Sulfonamides'
FROM demo.facilities f WHERE f.slug = 'mengo'
ON CONFLICT DO NOTHING;

-- Insert Demo Encounters
INSERT INTO demo.encounters (facility_id, patient_id, encounter_type, status, acuity_level, visit_reason, temperature, blood_pressure, heart_rate, respiratory_rate, oxygen_saturation, chief_complaint, doctor_name)
SELECT 
  f.id,
  p.id,
  'OPD',
  'active',
  'Red',
  'Fever and difficulty breathing',
  38.5,
  '140/90',
  102,
  28,
  92.0,
  'Fever, cough, and shortness of breath',
  'Dr. Sarah Kwagala'
FROM demo.facilities f
JOIN demo.patients p ON f.id = p.facility_id
WHERE f.slug = 'mengo' AND p.mrn = 'MHO-2026-001'
ON CONFLICT DO NOTHING;

INSERT INTO demo.encounters (facility_id, patient_id, encounter_type, status, acuity_level, visit_reason, temperature, blood_pressure, heart_rate, respiratory_rate, oxygen_saturation, chief_complaint, doctor_name)
SELECT 
  f.id,
  p.id,
  'OPD',
  'active',
  'Yellow',
  'Abdominal pain',
  37.2,
  '128/82',
  88,
  20,
  98.0,
  'Right sided abdominal pain for 3 days',
  'Dr. Okello Moses'
FROM demo.facilities f
JOIN demo.patients p ON f.id = p.facility_id
WHERE f.slug = 'mengo' AND p.mrn = 'MHO-2026-002'
ON CONFLICT DO NOTHING;

INSERT INTO demo.encounters (facility_id, patient_id, encounter_type, status, acuity_level, visit_reason, temperature, blood_pressure, heart_rate, respiratory_rate, oxygen_saturation, chief_complaint, doctor_name)
SELECT 
  f.id,
  p.id,
  'OPD',
  'active',
  'Green',
  'Routine follow-up',
  36.8,
  '118/76',
  72,
  18,
  99.0,
  'Routine hypertension follow-up',
  'Dr. Sarah Kwagala'
FROM demo.facilities f
JOIN demo.patients p ON f.id = p.facility_id
WHERE f.slug = 'mengo' AND p.mrn = 'MHO-2026-003'
ON CONFLICT DO NOTHING;

-- Insert Demo Diagnoses
INSERT INTO demo.encounter_diagnoses (encounter_id, icd11_code, diagnosis_text, certainty, is_primary)
SELECT 
  e.id,
  'CA40.0',
  'Pneumonia, unspecified',
  'presumptive',
  true
FROM demo.encounters e
JOIN demo.patients p ON e.patient_id = p.id
WHERE p.mrn = 'MHO-2026-001'
LIMIT 1
ON CONFLICT DO NOTHING;

-- Insert Demo Guidelines
INSERT INTO demo.clinical_guidelines (condition, icd11_code, guideline_text, recommendations, ucg_citation)
VALUES (
  'Pneumonia, unspecified',
  'CA40.0',
  'Pneumonia is an infection that inflames the air sacs in one or both lungs. The air sacs may fill with fluid or pus.',
  'Oxygen therapy, Antibiotics (Amoxicillin + Clavulanic Acid OR Ceftriaxone), Fluids, Monitor vitals, Consider chest X-ray',
  'Uganda Clinical Guidelines - Respiratory Infections v2.1'
)
ON CONFLICT DO NOTHING;

-- Insert Demo Insurance Providers
INSERT INTO demo.insurance_providers (facility_id, name, code, email)
SELECT 
  f.id,
  'Uganda National Health Insurance Scheme',
  'UNHIS',
  'support@unhis.ug'
FROM demo.facilities f WHERE f.slug = 'mengo'
ON CONFLICT DO NOTHING;

INSERT INTO demo.insurance_providers (facility_id, name, code, email)
SELECT 
  f.id,
  'AAR Insurance Uganda',
  'AAR',
  'claims@aarinsurance.ug'
FROM demo.facilities f WHERE f.slug = 'mengo'
ON CONFLICT DO NOTHING;
