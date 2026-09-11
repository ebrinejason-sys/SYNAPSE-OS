-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260605150957  name: add_synapse_id_core_tables
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.


CREATE TABLE IF NOT EXISTS patient_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  synapse_id TEXT UNIQUE,
  hospital_id UUID REFERENCES hospitals(id),
  unregistered_hospital TEXT,
  full_name TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  date_of_birth DATE,
  sex TEXT CHECK (sex IN ('male','female','other')),
  blood_group TEXT,
  national_id TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  allergies JSONB DEFAULT '[]',
  chronic_conditions JSONB DEFAULT '[]',
  current_medications JSONB DEFAULT '[]',
  immunizations JSONB DEFAULT '[]',
  identity_consent BOOLEAN DEFAULT false,
  passport_pin_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE OR REPLACE FUNCTION generate_synapse_id()
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  new_id TEXT;
  id_exists BOOLEAN;
BEGIN
  LOOP
    new_id := 'SYN-UG-' || upper(substring(
      replace(replace(encode(gen_random_bytes(4),'base64'),'+','A'),'/','B')
      FROM 1 FOR 6
    ));
    SELECT COUNT(*) > 0 INTO id_exists
    FROM patient_profiles WHERE synapse_id = new_id;
    EXIT WHEN NOT id_exists;
  END LOOP;
  RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION assign_synapse_id()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.synapse_id IS NULL THEN
    NEW.synapse_id := generate_synapse_id();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_synapse_id ON patient_profiles;
CREATE TRIGGER trg_assign_synapse_id
  BEFORE INSERT ON patient_profiles
  FOR EACH ROW EXECUTE FUNCTION assign_synapse_id();

CREATE TABLE IF NOT EXISTS passport_share_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  synapse_id TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL DEFAULT upper(substring(
    replace(replace(encode(gen_random_bytes(3),'base64'),'+','A'),'/','B')
    FROM 1 FOR 6
  )),
  token_type TEXT CHECK (token_type IN ('qr','code','transfer')),
  granted_to_hospital_id UUID REFERENCES hospitals(id),
  scope TEXT[] DEFAULT ARRAY['basic','visits','medications','allergies'],
  max_uses INTEGER DEFAULT 1,
  use_count INTEGER DEFAULT 0,
  expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '24 hours'),
  is_revoked BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS passport_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  synapse_id TEXT NOT NULL,
  accessed_by_user_id UUID REFERENCES auth.users(id),
  accessed_by_hospital_id UUID REFERENCES hospitals(id),
  access_type TEXT CHECK (access_type IN (
    'self','qr_scan','share_code','direct_transfer','emergency'
  )),
  share_token TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS patient_vitals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patient_profiles(id) ON DELETE CASCADE,
  synapse_id TEXT,
  encounter_id UUID,
  heart_rate INTEGER,
  systolic_bp INTEGER,
  diastolic_bp INTEGER,
  temperature DECIMAL,
  spo2 INTEGER,
  weight_kg DECIMAL,
  blood_glucose DECIMAL,
  respiratory_rate INTEGER,
  source TEXT DEFAULT 'manual',
  device_id TEXT,
  is_live_feed BOOLEAN DEFAULT false,
  recorded_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS live_feed_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  synapse_id TEXT NOT NULL,
  patient_id UUID REFERENCES patient_profiles(id),
  encounter_id UUID,
  hospital_id UUID REFERENCES hospitals(id),
  tenant_id UUID,
  status TEXT DEFAULT 'active',
  started_at TIMESTAMPTZ DEFAULT now(),
  ended_at TIMESTAMPTZ,
  last_ping TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS surveillance_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_ref TEXT UNIQUE DEFAULT 'RPT-' || upper(substring(gen_random_uuid()::text, 1, 8)),
  synapse_id TEXT,
  is_anonymous BOOLEAN DEFAULT true,
  symptoms TEXT[] NOT NULL,
  duration TEXT,
  severity TEXT CHECK (severity IN ('mild','moderate','severe')),
  district TEXT,
  subcounty TEXT,
  lat DECIMAL, lng DECIMAL,
  household_affected BOOLEAN,
  recent_travel BOOLEAN,
  travel_location TEXT,
  age_group TEXT,
  sex TEXT,
  reviewed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS health_bulletins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  severity TEXT DEFAULT 'info',
  target_type TEXT DEFAULT 'all',
  target_value TEXT,
  district TEXT,
  published_by UUID REFERENCES auth.users(id),
  is_published BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS apk_waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  phone TEXT,
  notified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_patient_profiles_synapse_id ON patient_profiles(synapse_id);
CREATE INDEX IF NOT EXISTS idx_patient_profiles_hospital_id ON patient_profiles(hospital_id);
CREATE INDEX IF NOT EXISTS idx_passport_tokens_token ON passport_share_tokens(token);
CREATE INDEX IF NOT EXISTS idx_patient_vitals_patient ON patient_vitals(patient_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_live_feed_active ON live_feed_sessions(synapse_id, status);
CREATE INDEX IF NOT EXISTS idx_surveillance_district ON surveillance_reports(district, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_surveillance_symptoms ON surveillance_reports USING GIN(symptoms);
