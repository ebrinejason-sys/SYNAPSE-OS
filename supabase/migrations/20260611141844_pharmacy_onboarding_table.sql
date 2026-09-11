-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260611141844  name: pharmacy_onboarding_table
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.


-- Migration 1d: Pharmacy onboarding tracking table
CREATE TABLE IF NOT EXISTS pharmacy_onboarding (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE UNIQUE,
  
  -- Steps: 0=invited, 1=account_created, 2=profile_complete, 3=store_setup, 
  --        4=inventory_started, 5=complete
  current_step          INTEGER DEFAULT 0,
  
  -- Invitation
  invite_token          TEXT UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  invite_sent_at        TIMESTAMPTZ,
  invite_expires_at     TIMESTAMPTZ DEFAULT now() + interval '7 days',
  
  -- Progress tracking
  account_created_at    TIMESTAMPTZ,
  profile_completed_at  TIMESTAMPTZ,
  store_setup_at        TIMESTAMPTZ,
  first_product_at      TIMESTAMPTZ,
  onboarding_completed_at TIMESTAMPTZ,
  
  -- Admin
  enrolled_by           UUID REFERENCES profiles(id),
  notes                 TEXT,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE pharmacy_onboarding ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'pharmacy_onboarding' AND policyname = 'platform_admin_full'
  ) THEN
    CREATE POLICY "platform_admin_full" ON pharmacy_onboarding
      FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'platform_admin')
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'pharmacy_onboarding' AND policyname = 'pharmacy_admin_own'
  ) THEN
    CREATE POLICY "pharmacy_admin_own" ON pharmacy_onboarding
      FOR SELECT USING (
        tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid())
      );
  END IF;
END $$;

-- Allow invite token lookup without auth (for the /invite/[token] page)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'pharmacy_onboarding' AND policyname = 'invite_token_lookup'
  ) THEN
    CREATE POLICY "invite_token_lookup" ON pharmacy_onboarding
      FOR SELECT USING (true);
  END IF;
END $$;

-- Seed onboarding record for existing pharmacy tenant
INSERT INTO pharmacy_onboarding (tenant_id, current_step)
VALUES ('8e801c8d-f970-4be2-a9e2-c886f779a18d', 0)
ON CONFLICT (tenant_id) DO NOTHING;
