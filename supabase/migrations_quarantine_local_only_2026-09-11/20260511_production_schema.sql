-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================
-- TENANTS (Facilities)
-- ============================================================
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  custom_domain TEXT UNIQUE,
  country TEXT NOT NULL DEFAULT 'UG',
  region TEXT,
  district TEXT,
  facility_type TEXT NOT NULL DEFAULT 'clinic',
  bed_capacity INTEGER,
  phone TEXT,
  email TEXT,
  address TEXT,
  logo_url TEXT,
  plan TEXT NOT NULL DEFAULT 'trial' CHECK (plan IN ('trial','starter','professional','enterprise')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  onboarding_step INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- PROFILES (Users linked to tenants)
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN (
    'platform_admin','facility_admin','doctor','nurse',
    'lab_tech','lab_supervisor','pharmacist','radiologist',
    'receptionist','patient','chw','independent_doctor'
  )),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  speciality TEXT,
  department_id UUID,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id)
);

-- ============================================================
-- DEPARTMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  type TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- PATIENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  mrn TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  sex TEXT NOT NULL CHECK (sex IN ('M','F','I')),
  phone TEXT,
  email TEXT,
  address TEXT,
  district TEXT,
  nin TEXT,
  blood_group TEXT,
  allergies TEXT[] NOT NULL DEFAULT '{}',
  comorbidities TEXT[] NOT NULL DEFAULT '{}',
  insurance_provider_id UUID,
  insurance_number TEXT,
  linked_app_user_id UUID,
  expo_push_token TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  version INTEGER NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, mrn)
);

-- ============================================================
-- ENCOUNTERS
-- ============================================================
CREATE TABLE IF NOT EXISTS encounters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id),
  department_id UUID REFERENCES departments(id),
  encounter_type TEXT NOT NULL DEFAULT 'OPD' CHECK (
    encounter_type IN ('OPD','IPD','EMERGENCY','TELE','ANC','PROCEDURE')
  ),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','signed','cancelled')),
  acuity TEXT CHECK (acuity IN ('IMMEDIATE','URGENT','ROUTINE','EXPECTANT')),
  chief_complaint TEXT,
  history_of_presenting_illness TEXT,
  examination_findings TEXT,
  assessment TEXT,
  plan TEXT,
  soap_note TEXT,
  discharge_instructions TEXT,
  temp NUMERIC(5,2),
  bp_systolic INTEGER,
  bp_diastolic INTEGER,
  heart_rate INTEGER,
  respiratory_rate INTEGER,
  spo2 NUMERIC(5,2),
  weight_kg NUMERIC(6,2),
  height_cm NUMERIC(6,2),
  bmi NUMERIC(5,2),
  doctor_id UUID REFERENCES profiles(id),
  nurse_id UUID REFERENCES profiles(id),
  is_signed BOOLEAN NOT NULL DEFAULT false,
  signed_at TIMESTAMPTZ,
  insurance_claim_id UUID,
  tele_session_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  version INTEGER NOT NULL DEFAULT 1
);

-- ============================================================
-- ENCOUNTER DIAGNOSES
-- ============================================================
CREATE TABLE IF NOT EXISTS encounter_diagnoses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  encounter_id UUID NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
  icd11_code TEXT NOT NULL,
  diagnosis_text TEXT NOT NULL,
  certainty TEXT NOT NULL DEFAULT 'provisional' CHECK (
    certainty IN ('confirmed','provisional','differential')
  ),
  is_primary BOOLEAN NOT NULL DEFAULT false,
  ai_suggested BOOLEAN NOT NULL DEFAULT false,
  ai_confidence NUMERIC(3,2),
  override_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- CLINICAL NOTES
-- ============================================================
CREATE TABLE IF NOT EXISTS clinical_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  encounter_id UUID NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id),
  note_type TEXT NOT NULL CHECK (note_type IN (
    'soap','progress','discharge','consult','procedure',
    'nursing','pharmacy','imaging'
  )),
  content TEXT NOT NULL,
  authored_by UUID NOT NULL REFERENCES profiles(id),
  is_signed BOOLEAN NOT NULL DEFAULT false,
  signed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  version INTEGER NOT NULL DEFAULT 1
);

-- ============================================================
-- CLINICAL NOTE EMBEDDINGS (pgvector for History Intelligence)
-- ============================================================
CREATE TABLE IF NOT EXISTS clinical_note_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id),
  encounter_id UUID REFERENCES encounters(id),
  note_type TEXT,
  source_table TEXT,
  source_id UUID,
  content_text TEXT NOT NULL,
  content_tsvector TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', content_text)) STORED,
  embedding vector(1536),
  recorded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cne_patient_idx ON clinical_note_embeddings(patient_id);
CREATE INDEX IF NOT EXISTS cne_embedding_idx ON clinical_note_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS cne_tsvector_idx ON clinical_note_embeddings USING GIN (content_tsvector);

-- ============================================================
-- PATIENT HISTORY QUERIES
-- ============================================================
CREATE TABLE IF NOT EXISTS patient_history_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  queried_by UUID NOT NULL REFERENCES profiles(id),
  query_text TEXT NOT NULL,
  query_embedding vector(1536),
  filters JSONB,
  ai_summary TEXT,
  ai_model_used TEXT,
  guideline_citations TEXT[],
  source_count INTEGER,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_starred BOOLEAN NOT NULL DEFAULT false
);

-- ============================================================
-- LAB ORDERS
-- ============================================================
CREATE TABLE IF NOT EXISTS lab_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  encounter_id UUID NOT NULL REFERENCES encounters(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  loinc_code TEXT,
  test_name TEXT NOT NULL,
  urgency TEXT NOT NULL DEFAULT 'ROUTINE' CHECK (urgency IN ('STAT','URGENT','ROUTINE')),
  status TEXT NOT NULL DEFAULT 'ordered' CHECK (
    status IN ('ordered','collected','processing','resulted','verified','cancelled')
  ),
  ordered_by UUID NOT NULL REFERENCES profiles(id),
  ordered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  collected_at TIMESTAMPTZ,
  resulted_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES profiles(id),
  insurance_covered BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- LAB RESULTS
-- ============================================================
CREATE TABLE IF NOT EXISTS lab_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lab_order_id UUID NOT NULL REFERENCES lab_orders(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  loinc_code TEXT,
  test_name TEXT NOT NULL,
  result_value TEXT NOT NULL,
  unit TEXT,
  reference_range TEXT,
  status TEXT NOT NULL DEFAULT 'preliminary' CHECK (
    status IN ('preliminary','final','corrected','cancelled')
  ),
  is_critical BOOLEAN NOT NULL DEFAULT false,
  is_abnormal BOOLEAN NOT NULL DEFAULT false,
  ai_interpretation TEXT,
  ai_model_used TEXT,
  instrument_bridge_id UUID,
  released_to_patient_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  version INTEGER NOT NULL DEFAULT 1
);

-- ============================================================
-- LAB INSTRUMENT BRIDGES
-- ============================================================
CREATE TABLE IF NOT EXISTS lab_instrument_bridges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  instrument_type TEXT,
  connection_type TEXT CHECK (connection_type IN ('serial','tcp','file','hl7_mllp')),
  connection_config JSONB,
  api_key TEXT UNIQUE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- PHARMACY ORDERS
-- ============================================================
CREATE TABLE IF NOT EXISTS pharmacy_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  encounter_id UUID NOT NULL REFERENCES encounters(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending','dispensing','dispensed','cancelled')
  ),
  total_cost NUMERIC(10,2),
  insurance_covered NUMERIC(10,2) NOT NULL DEFAULT 0,
  patient_copay NUMERIC(10,2) NOT NULL DEFAULT 0,
  prescribed_by UUID NOT NULL REFERENCES profiles(id),
  dispensed_by UUID REFERENCES profiles(id),
  dispensed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- PHARMACY ORDER ITEMS
-- ============================================================
CREATE TABLE IF NOT EXISTS pharmacy_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  pharmacy_order_id UUID NOT NULL REFERENCES pharmacy_orders(id) ON DELETE CASCADE,
  medication_name TEXT NOT NULL,
  atc_code TEXT,
  strength TEXT,
  quantity INTEGER NOT NULL,
  unit TEXT NOT NULL DEFAULT 'tablets',
  unit_price NUMERIC(10,2),
  total_price NUMERIC(10,2),
  dosage TEXT,
  frequency TEXT,
  duration_days INTEGER,
  route TEXT DEFAULT 'oral',
  batch_number TEXT,
  expiry_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- DRUG INVENTORY
-- ============================================================
CREATE TABLE IF NOT EXISTS drug_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  medication_name TEXT NOT NULL,
  atc_code TEXT,
  strength TEXT,
  dosage_form TEXT,
  batch_number TEXT NOT NULL,
  quantity_in_stock INTEGER NOT NULL DEFAULT 0,
  unit_price NUMERIC(10,2),
  expiry_date DATE NOT NULL,
  supplier TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- INSURANCE PROVIDERS
-- ============================================================
CREATE TABLE IF NOT EXISTS insurance_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  website TEXT,
  phone TEXT,
  email TEXT,
  api_endpoint TEXT,
  api_key_encrypted TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- INSURANCE CLAIMS
-- ============================================================
CREATE TABLE IF NOT EXISTS insurance_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  encounter_id UUID NOT NULL REFERENCES encounters(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  insurance_provider_id UUID NOT NULL REFERENCES insurance_providers(id),
  claim_amount NUMERIC(10,2) NOT NULL,
  approved_amount NUMERIC(10,2),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending','submitted','approved','partial','rejected','appealing','paid')
  ),
  icd11_codes TEXT[] NOT NULL DEFAULT '{}',
  rejection_reason TEXT,
  ai_appeal_letter TEXT,
  submitted_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- CLINICAL SCORE DEFINITIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS score_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  version TEXT,
  parameters JSONB NOT NULL,
  calculation_logic TEXT,
  interpretation_ranges JSONB,
  reference_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- SCORE CALCULATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS score_calculations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id),
  encounter_id UUID REFERENCES encounters(id),
  score_definition_code TEXT NOT NULL REFERENCES score_definitions(code),
  calculated_by UUID REFERENCES profiles(id),
  parameters_input JSONB NOT NULL,
  calculated_value NUMERIC,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ai_interpretation TEXT,
  ai_confidence NUMERIC(3,2),
  ai_model_used TEXT,
  ai_guideline_citation TEXT,
  final_interpretation TEXT,
  final_severity TEXT CHECK (
    final_severity IN ('low','moderate','high','critical','normal')
  ),
  overridden_by UUID REFERENCES profiles(id),
  override_reason TEXT,
  overridden_at TIMESTAMPTZ,
  is_self_assessment BOOLEAN NOT NULL DEFAULT false,
  shared_with_provider BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  version INTEGER NOT NULL DEFAULT 1
);

-- ============================================================
-- FACILITY REFERRALS
-- ============================================================
CREATE TABLE IF NOT EXISTS facility_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_tenant_id UUID NOT NULL REFERENCES tenants(id),
  to_tenant_id UUID NOT NULL REFERENCES tenants(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  encounter_id UUID NOT NULL REFERENCES encounters(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending','accepted','rejected','completed','cancelled')
  ),
  speciality TEXT NOT NULL,
  urgency TEXT NOT NULL DEFAULT 'ROUTINE' CHECK (urgency IN ('IMMEDIATE','URGENT','ROUTINE')),
  clinical_summary TEXT NOT NULL,
  fhir_bundle JSONB,
  consent_obtained BOOLEAN NOT NULL DEFAULT false,
  consent_method TEXT CHECK (consent_method IN ('screen','sms_otp')),
  accepted_by UUID REFERENCES profiles(id),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- CROSS TENANT ACCESS (for referrals, peer consults)
-- ============================================================
CREATE TABLE IF NOT EXISTS cross_tenant_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  granting_tenant_id UUID NOT NULL REFERENCES tenants(id),
  accessing_tenant_id UUID NOT NULL REFERENCES tenants(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  referral_id UUID REFERENCES facility_referrals(id),
  access_type TEXT NOT NULL CHECK (access_type IN ('read','referral','consult')),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- ============================================================
-- AUDIT EVENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  user_id UUID REFERENCES auth.users(id),
  patient_id UUID REFERENCES patients(id),
  encounter_id UUID REFERENCES encounters(id),
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  old_value JSONB,
  new_value JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- OUTBREAK ALERTS
-- ============================================================
CREATE TABLE IF NOT EXISTS outbreak_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by_tenant_id UUID REFERENCES tenants(id),
  icd11_code TEXT NOT NULL,
  disease_name TEXT NOT NULL,
  alert_level TEXT NOT NULL DEFAULT 'INFO' CHECK (
    alert_level IN ('INFO','WATCH','WARNING','EMERGENCY')
  ),
  affected_districts TEXT[] NOT NULL DEFAULT '{}',
  description TEXT NOT NULL,
  recommendations TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- IMID CODES (International Medical ID)
-- ============================================================
CREATE TABLE IF NOT EXISTS imid_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  code TEXT UNIQUE NOT NULL,
  qr_data TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- IMID ACCESS LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS imid_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  imid_code_id UUID NOT NULL REFERENCES imid_codes(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  accessed_by_ip INET,
  accessed_by_user_agent TEXT,
  access_context TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- TELE SESSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS tele_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  patient_app_user_id UUID,
  doctor_id UUID REFERENCES profiles(id),
  chatbot_answers JSONB,
  triage_level TEXT CHECK (triage_level IN ('emergency','urgent','routine')),
  triage_score INTEGER,
  status TEXT NOT NULL DEFAULT 'chatbot' CHECK (
    status IN ('chatbot','triaged','booked','in_call','completed','cancelled')
  ),
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  livekit_room_name TEXT,
  transcript TEXT,
  soap_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- STAFF INVITATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS staff_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  invited_by UUID REFERENCES profiles(id),
  accepted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- PILOT APPLICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS pilot_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_name TEXT NOT NULL,
  facility_type TEXT NOT NULL,
  bed_count INTEGER,
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  contact_phone TEXT,
  country TEXT NOT NULL DEFAULT 'UG',
  district TEXT,
  pain_point TEXT,
  plan TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending','reviewing','approved','rejected','provisioned')
  ),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- OFFLINE SYNC QUEUE
-- ============================================================
CREATE TABLE IF NOT EXISTS offline_sync_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  resource_type TEXT NOT NULL,
  resource_id UUID,
  operation TEXT NOT NULL CHECK (operation IN ('insert','update','delete')),
  payload JSONB NOT NULL,
  synced_at TIMESTAMPTZ,
  conflict_detected BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_profiles_tenant ON profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_profiles_user ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_patients_tenant ON patients(tenant_id);
CREATE INDEX IF NOT EXISTS idx_patients_mrn ON patients(tenant_id, mrn);
CREATE INDEX IF NOT EXISTS idx_encounters_tenant ON encounters(tenant_id);
CREATE INDEX IF NOT EXISTS idx_encounters_patient ON encounters(patient_id);
CREATE INDEX IF NOT EXISTS idx_encounters_status ON encounters(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_lab_orders_tenant ON lab_orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_lab_orders_status ON lab_orders(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_lab_results_order ON lab_results(lab_order_id);
CREATE INDEX IF NOT EXISTS idx_pharmacy_orders_tenant ON pharmacy_orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_score_calc_patient ON score_calculations(patient_id);
CREATE INDEX IF NOT EXISTS idx_audit_tenant ON audit_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_patient ON audit_events(patient_id);
CREATE INDEX IF NOT EXISTS idx_outbreak_active ON outbreak_alerts(is_active) WHERE is_active = true;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE encounters ENABLE ROW LEVEL SECURITY;
ALTER TABLE encounter_diagnoses ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinical_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinical_note_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacy_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacy_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE drug_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE insurance_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE insurance_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE score_calculations ENABLE ROW LEVEL SECURITY;
ALTER TABLE facility_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbreak_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE tele_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE offline_sync_queue ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user's tenant_id
CREATE OR REPLACE FUNCTION current_user_tenant_id()
RETURNS UUID
LANGUAGE sql STABLE
AS $$
  SELECT tenant_id FROM profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- Helper function to check if current user is platform admin
CREATE OR REPLACE FUNCTION is_platform_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = auth.uid() AND role = 'platform_admin'
  );
$$;

-- Profiles RLS
CREATE POLICY "Users see own tenant profiles" ON profiles
  FOR ALL USING (tenant_id = current_user_tenant_id() OR is_platform_admin());

-- Patients RLS
CREATE POLICY "Tenant isolation for patients" ON patients
  FOR ALL USING (tenant_id = current_user_tenant_id() OR is_platform_admin());

-- Encounters RLS
CREATE POLICY "Tenant isolation for encounters" ON encounters
  FOR ALL USING (tenant_id = current_user_tenant_id() OR is_platform_admin());

-- Encounter diagnoses RLS
CREATE POLICY "Tenant isolation for diagnoses" ON encounter_diagnoses
  FOR ALL USING (tenant_id = current_user_tenant_id() OR is_platform_admin());

-- Clinical notes RLS
CREATE POLICY "Tenant isolation for clinical notes" ON clinical_notes
  FOR ALL USING (tenant_id = current_user_tenant_id() OR is_platform_admin());

-- Clinical note embeddings RLS
CREATE POLICY "Tenant isolation for embeddings" ON clinical_note_embeddings
  FOR ALL USING (tenant_id = current_user_tenant_id() OR is_platform_admin());

-- Lab orders RLS
CREATE POLICY "Tenant isolation for lab orders" ON lab_orders
  FOR ALL USING (tenant_id = current_user_tenant_id() OR is_platform_admin());

-- Lab results RLS
CREATE POLICY "Tenant isolation for lab results" ON lab_results
  FOR ALL USING (tenant_id = current_user_tenant_id() OR is_platform_admin());

-- Pharmacy orders RLS
CREATE POLICY "Tenant isolation for pharmacy orders" ON pharmacy_orders
  FOR ALL USING (tenant_id = current_user_tenant_id() OR is_platform_admin());

-- Pharmacy order items RLS
CREATE POLICY "Tenant isolation for pharmacy items" ON pharmacy_order_items
  FOR ALL USING (tenant_id = current_user_tenant_id() OR is_platform_admin());

-- Drug inventory RLS
CREATE POLICY "Tenant isolation for drug inventory" ON drug_inventory
  FOR ALL USING (tenant_id = current_user_tenant_id() OR is_platform_admin());

-- Insurance providers RLS
CREATE POLICY "Tenant isolation for insurance providers" ON insurance_providers
  FOR ALL USING (tenant_id = current_user_tenant_id() OR is_platform_admin());

-- Insurance claims RLS
CREATE POLICY "Tenant isolation for insurance claims" ON insurance_claims
  FOR ALL USING (tenant_id = current_user_tenant_id() OR is_platform_admin());

-- Score calculations RLS
CREATE POLICY "Tenant isolation for scores" ON score_calculations
  FOR ALL USING (tenant_id = current_user_tenant_id() OR is_platform_admin());

-- Audit events RLS (read-only for own tenant)
CREATE POLICY "Tenant audit read" ON audit_events
  FOR SELECT USING (tenant_id = current_user_tenant_id() OR is_platform_admin());

-- Outbreak alerts (public read, admin write)
CREATE POLICY "Public read outbreak alerts" ON outbreak_alerts
  FOR SELECT USING (is_active = true);
CREATE POLICY "Platform admin manage outbreak alerts" ON outbreak_alerts
  FOR ALL USING (is_platform_admin());

-- Facility referrals (both tenants can see)
CREATE POLICY "Referral tenant access" ON facility_referrals
  FOR SELECT USING (
    from_tenant_id = current_user_tenant_id() OR
    to_tenant_id = current_user_tenant_id() OR
    is_platform_admin()
  );
CREATE POLICY "Referral insert" ON facility_referrals
  FOR INSERT WITH CHECK (from_tenant_id = current_user_tenant_id());
CREATE POLICY "Referral update" ON facility_referrals
  FOR UPDATE USING (
    from_tenant_id = current_user_tenant_id() OR
    to_tenant_id = current_user_tenant_id()
  );

-- Tele sessions RLS
CREATE POLICY "Tele session tenant access" ON tele_sessions
  FOR ALL USING (tenant_id = current_user_tenant_id() OR is_platform_admin());

-- Staff invitations RLS
CREATE POLICY "Tenant invitation access" ON staff_invitations
  FOR ALL USING (tenant_id = current_user_tenant_id() OR is_platform_admin());

-- Offline sync queue RLS
CREATE POLICY "Own sync queue" ON offline_sync_queue
  FOR ALL USING (tenant_id = current_user_tenant_id() AND user_id = auth.uid());

-- Departments RLS
CREATE POLICY "Tenant isolation for departments" ON departments
  FOR ALL USING (tenant_id = current_user_tenant_id() OR is_platform_admin());

-- score_definitions is public (no tenant_id, read-only for all)
ALTER TABLE score_definitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Score definitions public read" ON score_definitions
  FOR SELECT USING (is_active = true);

-- ============================================================
-- REALTIME (enable for key tables)
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE lab_orders;
ALTER PUBLICATION supabase_realtime ADD TABLE lab_results;
ALTER PUBLICATION supabase_realtime ADD TABLE encounters;
ALTER PUBLICATION supabase_realtime ADD TABLE tele_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE outbreak_alerts;
