CREATE TABLE IF NOT EXISTS platform_flags (
  key TEXT PRIMARY KEY,
  value BOOLEAN DEFAULT false,
  hospital_id UUID REFERENCES hospitals(id),
  updated_by UUID REFERENCES profiles(id),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hospital_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_name TEXT NOT NULL,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  location TEXT,
  beds_count INTEGER,
  current_system TEXT,
  notes TEXT,
  stage TEXT DEFAULT 'interest' CHECK (stage IN ('interest','demo','trial','converted','lost')),
  source TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE hospital_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS platform_admin_only ON hospital_leads;
CREATE POLICY platform_admin_only ON hospital_leads FOR ALL USING (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = 'platform_admin'
  )
);

CREATE TABLE IF NOT EXISTS ai_call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  hospital_id UUID,
  endpoint TEXT,
  latency_ms INTEGER,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
