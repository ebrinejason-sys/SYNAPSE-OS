-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260607130305  name: synapse_app_mobile_schema
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.


-- 1. Add missing columns to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS synapse_id TEXT UNIQUE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS app_user BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS date_of_birth TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS blood_type TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_sign_in_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_profiles_synapse_id ON profiles(synapse_id);
CREATE INDEX IF NOT EXISTS idx_profiles_app_user ON profiles(app_user);

-- 2. Create calls table
CREATE TABLE IF NOT EXISTS calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_name TEXT NOT NULL UNIQUE,
  caller_id UUID REFERENCES profiles(id),
  callee_id UUID REFERENCES profiles(id),
  caller_synapse_id TEXT,
  callee_synapse_id TEXT,
  status TEXT DEFAULT 'ringing',
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  call_type TEXT DEFAULT 'video',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own calls" ON calls
  FOR INSERT WITH CHECK (auth.uid() = caller_id);

CREATE POLICY "Users can see their own calls" ON calls
  FOR SELECT USING (auth.uid() = caller_id OR auth.uid() = callee_id);

CREATE POLICY "Users can update their own calls" ON calls
  FOR UPDATE USING (auth.uid() = caller_id OR auth.uid() = callee_id);

CREATE INDEX IF NOT EXISTS idx_calls_caller ON calls(caller_id);
CREATE INDEX IF NOT EXISTS idx_calls_callee ON calls(callee_id);
CREATE INDEX IF NOT EXISTS idx_calls_status ON calls(status);
CREATE INDEX IF NOT EXISTS idx_calls_room ON calls(room_name);

-- 3. Create app_vitals table (separate from clinical vitals, for wearable/app data)
CREATE TABLE IF NOT EXISTS app_vitals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES profiles(id),
  heart_rate INTEGER,
  spo2 DECIMAL(5,1),
  steps_today INTEGER,
  blood_pressure_systolic INTEGER,
  blood_pressure_diastolic INTEGER,
  temperature DECIMAL(4,1),
  weight DECIMAL(5,1),
  source TEXT DEFAULT 'manual_entry',
  recorded_at TIMESTAMPTZ DEFAULT now(),
  tenant_id UUID REFERENCES tenants(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE app_vitals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own app vitals" ON app_vitals
  FOR INSERT WITH CHECK (auth.uid() = patient_id);

CREATE POLICY "Users can see own app vitals" ON app_vitals
  FOR SELECT USING (auth.uid() = patient_id);

CREATE INDEX IF NOT EXISTS idx_app_vitals_patient ON app_vitals(patient_id);
CREATE INDEX IF NOT EXISTS idx_app_vitals_recorded ON app_vitals(recorded_at DESC);

-- 4. Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE calls;
ALTER PUBLICATION supabase_realtime ADD TABLE app_vitals;
