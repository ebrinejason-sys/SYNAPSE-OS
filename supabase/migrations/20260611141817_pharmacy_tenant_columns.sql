-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260611141817  name: pharmacy_tenant_columns
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.


-- Migration 1a: Add missing pharmacy columns to tenants table
ALTER TABLE tenants 
  ADD COLUMN IF NOT EXISTS default_subdomain TEXT,
  ADD COLUMN IF NOT EXISTS is_network_member BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS network_listing_name TEXT,
  ADD COLUMN IF NOT EXISTS accepts_refill_requests BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS monthly_fee_ugx INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS subscription_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS subscription_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS lat DECIMAL(9,6),
  ADD COLUMN IF NOT EXISTS lng DECIMAL(9,6),
  ADD COLUMN IF NOT EXISTS modules_enabled TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'trial';

-- Set default_subdomain from slug for existing tenants
UPDATE tenants SET default_subdomain = slug WHERE default_subdomain IS NULL;

-- Add unique constraint on default_subdomain
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tenants_default_subdomain_key'
  ) THEN
    ALTER TABLE tenants ADD CONSTRAINT tenants_default_subdomain_key UNIQUE (default_subdomain);
  END IF;
END $$;

-- Update existing pharmacy tenant to active
UPDATE tenants 
SET status = 'active', 
    is_active = true,
    default_subdomain = 'pharm-test',
    modules_enabled = ARRAY['inventory','dispensing','network','staff','reports']
WHERE id = '8e801c8d-f970-4be2-a9e2-c886f779a18d';

-- Ensure facility_type check constraint includes all needed values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'tenants_facility_type_check' AND conrelid = 'tenants'::regclass
  ) THEN
    ALTER TABLE tenants ADD CONSTRAINT tenants_facility_type_check 
      CHECK (facility_type IN ('hospital','clinic','pharmacy','lab','imaging_center','dental','mental_health'));
  END IF;
END $$;
