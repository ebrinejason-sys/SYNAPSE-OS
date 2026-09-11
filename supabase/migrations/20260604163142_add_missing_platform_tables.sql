-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260604163142  name: add_missing_platform_tables
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.

CREATE TABLE IF NOT EXISTS hospital_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID REFERENCES hospitals(id) ON DELETE CASCADE,
  tenant_id UUID,
  module_key TEXT NOT NULL,
  is_active BOOLEAN DEFAULT false,
  activated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(hospital_id, module_key)
);
ALTER TABLE hospital_modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hospital_modules
  USING ((auth.jwt() ->> 'tenant_id')::uuid = tenant_id);

CREATE TABLE IF NOT EXISTS surveillance_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_ref TEXT UNIQUE DEFAULT 'RPT-' || upper(substring(gen_random_uuid()::text,1,8)),
  tenant_id UUID,
  is_anonymous BOOLEAN DEFAULT true,
  symptoms TEXT[] NOT NULL,
  duration TEXT,
  severity TEXT CHECK (severity IN ('mild','moderate','severe')),
  district TEXT,
  lat DECIMAL,
  lng DECIMAL,
  household_affected BOOLEAN,
  recent_travel BOOLEAN,
  travel_location TEXT,
  reviewed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE surveillance_reports ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS health_bulletins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  severity TEXT CHECK (severity IN ('info','warning','critical')) DEFAULT 'info',
  target_type TEXT DEFAULT 'all',
  target_value TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE health_bulletins ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS apk_waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  notified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
