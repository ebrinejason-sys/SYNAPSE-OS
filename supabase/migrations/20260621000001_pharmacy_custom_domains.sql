-- Pharmacy custom domains → tenant mapping (Feature 2)
-- Additive + idempotent. Safe to run against live project qfqakzmjatszisuqjwon.
--
-- NOTE: this table already exists on the live project (created out-of-band during
-- earlier work). This migration is written defensively (IF NOT EXISTS / IF EXISTS)
-- so it reconciles any environment to the same schema + RLS without error.
--
-- A separate, pre-existing `tenant_domains` table is owned by the hospital/web
-- side (different schema: hospital_id, tenant_key, provisioning_status, …). We
-- intentionally use a dedicated `pharmacy_custom_domains` table to avoid colliding
-- with it.

CREATE TABLE IF NOT EXISTS pharmacy_custom_domains (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  domain      text NOT NULL,
  is_primary  boolean NOT NULL DEFAULT false,
  verified    boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- One row per hostname.
CREATE UNIQUE INDEX IF NOT EXISTS pharmacy_custom_domains_domain_key
  ON pharmacy_custom_domains (lower(domain));

CREATE INDEX IF NOT EXISTS idx_pharmacy_custom_domains_tenant
  ON pharmacy_custom_domains (tenant_id);

-- Only one primary domain per tenant.
CREATE UNIQUE INDEX IF NOT EXISTS pharmacy_custom_domains_one_primary
  ON pharmacy_custom_domains (tenant_id)
  WHERE is_primary;

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- Resolution + management run through the service role (which bypasses RLS).
-- These policies are a safety net for any direct anon/authenticated access:
-- platform/superadmins may read; nobody else can. Writes are service-role only.
ALTER TABLE pharmacy_custom_domains ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pharmacy_custom_domains_admin_read ON pharmacy_custom_domains;
CREATE POLICY pharmacy_custom_domains_admin_read ON pharmacy_custom_domains
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('platform_admin', 'superadmin')
    )
  );

GRANT SELECT ON pharmacy_custom_domains TO authenticated;
-- service_role retains full access (bypasses RLS).
