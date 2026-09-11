-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260716110812  name: backfill_missing_baseline_tables
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.

-- Backfill: 18 tables defined in 20260511_production_schema.sql that were never
-- applied to the live project (it evolved from a different baseline).
-- Adaptations from the original file:
--   * RLS policies use current_tenant_id() (custom-auth helper) instead of the
--     never-created current_user_tenant_id(). Helper functions are NOT touched.
--   * offline_sync_queue.user_id references profiles(id), not auth.users(id) —
--     custom auth owns user IDs (see 20260613000004_custom_auth_profile_ids).
--   * drug_inventory matches the live hospital inventory UI contract
--     (generic/brand names, UGX pricing, reorder_level) instead of the stale spec.
--   * RLS is enabled on ALL new tables, including those the original file missed
--     (patient_history_queries, lab_instrument_bridges, cross_tenant_access,
--     imid_codes, imid_access_log, pilot_applications).
--   * lab_results / encounter_diagnoses already exist and are not touched.
--   * No CREATE POLICY / ALTER on any pre-existing table.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

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

CREATE INDEX IF NOT EXISTS idx_lab_orders_tenant ON lab_orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_lab_orders_status ON lab_orders(tenant_id, status);

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

CREATE TABLE IF NOT EXISTS drug_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  generic_name TEXT NOT NULL,
  brand_name TEXT,
  formulation TEXT,
  category TEXT,
  atc_code TEXT,
  strength TEXT,
  dosage_form TEXT,
  batch_number TEXT,
  quantity_in_stock INTEGER NOT NULL DEFAULT 0,
  reorder_level INTEGER NOT NULL DEFAULT 10,
  unit_price_ugx NUMERIC(12,2),
  expiry_date DATE,
  supplier TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_drug_inventory_tenant ON drug_inventory(tenant_id);

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

CREATE INDEX IF NOT EXISTS idx_score_calc_patient ON score_calculations(patient_id);

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

CREATE INDEX IF NOT EXISTS idx_outbreak_active ON outbreak_alerts(is_active) WHERE is_active = true;

CREATE TABLE IF NOT EXISTS imid_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  code TEXT UNIQUE NOT NULL,
  qr_data TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS imid_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  imid_code_id UUID NOT NULL REFERENCES imid_codes(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  accessed_by_ip INET,
  accessed_by_user_agent TEXT,
  access_context TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

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

CREATE TABLE IF NOT EXISTS offline_sync_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  operation TEXT NOT NULL CHECK (operation IN ('insert','update','delete')),
  payload JSONB NOT NULL,
  synced_at TIMESTAMPTZ,
  conflict_detected BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE clinical_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinical_note_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_history_queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_instrument_bridges ENABLE ROW LEVEL SECURITY;
ALTER TABLE drug_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE insurance_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE insurance_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE score_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE score_calculations ENABLE ROW LEVEL SECURITY;
ALTER TABLE facility_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE cross_tenant_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbreak_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE imid_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE imid_access_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE tele_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE pilot_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE offline_sync_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for clinical notes" ON clinical_notes
  FOR ALL USING (tenant_id = current_tenant_id() OR is_platform_admin());

CREATE POLICY "Tenant isolation for embeddings" ON clinical_note_embeddings
  FOR ALL USING (tenant_id = current_tenant_id() OR is_platform_admin());

CREATE POLICY "Tenant isolation for history queries" ON patient_history_queries
  FOR ALL USING (tenant_id = current_tenant_id() OR is_platform_admin());

CREATE POLICY "Tenant isolation for lab orders" ON lab_orders
  FOR ALL USING (tenant_id = current_tenant_id() OR is_platform_admin());

CREATE POLICY "Tenant isolation for instrument bridges" ON lab_instrument_bridges
  FOR ALL USING (tenant_id = current_tenant_id() OR is_platform_admin());

CREATE POLICY "Tenant isolation for drug inventory" ON drug_inventory
  FOR ALL USING (tenant_id = current_tenant_id() OR is_platform_admin());

CREATE POLICY "Tenant isolation for insurance providers" ON insurance_providers
  FOR ALL USING (tenant_id = current_tenant_id() OR is_platform_admin());

CREATE POLICY "Tenant isolation for insurance claims" ON insurance_claims
  FOR ALL USING (tenant_id = current_tenant_id() OR is_platform_admin());

CREATE POLICY "Tenant isolation for scores" ON score_calculations
  FOR ALL USING (tenant_id = current_tenant_id() OR is_platform_admin());

CREATE POLICY "Tele session tenant access" ON tele_sessions
  FOR ALL USING (tenant_id = current_tenant_id() OR is_platform_admin());

CREATE POLICY "Tenant invitation access" ON staff_invitations
  FOR ALL USING (tenant_id = current_tenant_id() OR is_platform_admin());

CREATE POLICY "Score definitions public read" ON score_definitions
  FOR SELECT USING (is_active = true);

CREATE POLICY "Public read outbreak alerts" ON outbreak_alerts
  FOR SELECT USING (is_active = true);
CREATE POLICY "Platform admin manage outbreak alerts" ON outbreak_alerts
  FOR ALL USING (is_platform_admin());

CREATE POLICY "Referral tenant access" ON facility_referrals
  FOR SELECT USING (
    from_tenant_id = current_tenant_id() OR
    to_tenant_id = current_tenant_id() OR
    is_platform_admin()
  );
CREATE POLICY "Referral insert" ON facility_referrals
  FOR INSERT WITH CHECK (from_tenant_id = current_tenant_id());
CREATE POLICY "Referral update" ON facility_referrals
  FOR UPDATE USING (
    from_tenant_id = current_tenant_id() OR
    to_tenant_id = current_tenant_id()
  );

CREATE POLICY "Platform admin manage cross tenant access" ON cross_tenant_access
  FOR ALL USING (is_platform_admin());

CREATE POLICY "Own sync queue" ON offline_sync_queue
  FOR ALL USING (tenant_id = current_tenant_id() AND user_id = auth.uid());

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['lab_orders','tele_sessions','outbreak_alerts']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END;
$$;
