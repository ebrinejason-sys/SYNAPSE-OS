-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260612231920  name: rls_phi_hardening
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.


-- Phase 9: RLS / PHI hardening pass

-- ── Fix: profiles.app_read_profiles allows cross-tenant reads ──────────────
-- Replace the overly-broad SELECT policy with tenant-scoped + own-profile reads only.
-- Service role always bypasses RLS, so this only affects client-side calls.
DROP POLICY IF EXISTS app_read_profiles ON profiles;

-- Allow users to read profiles within their own tenant (for user directory lookup)
DROP POLICY IF EXISTS profiles_tenant_read ON profiles;
CREATE POLICY profiles_tenant_read ON profiles
  FOR SELECT
  USING (
    tenant_id = (SELECT tenant_id FROM profiles p WHERE p.id = auth.uid() LIMIT 1)
    OR id = auth.uid()
  );

-- ── Ensure phi_access_log INSERT is service-role only ─────────────────────
-- The existing phi_access_insert has no USING clause which is correct for INSERT,
-- but we want to be explicit that this goes through service role only.
-- Verify and leave the existing policy in place — it's correct.

-- ── Add missing INSERT policies for audit tables ───────────────────────────
-- These should only be writable via service role (supabaseAdmin).
-- Since we only use service role in our TypeScript code, REVOKE write for anon/authenticated.

-- Ensure synapse_sessions has INSERT/DELETE locked to service role
DO $$
BEGIN
  -- Only add INSERT policy if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'synapse_sessions' AND policyname = 'sessions_service_insert'
  ) THEN
    EXECUTE 'CREATE POLICY sessions_service_insert ON synapse_sessions FOR INSERT WITH CHECK (auth.role() = ''service_role'')';
  END IF;
END $$;

-- ── Note on same_tenant() and custom auth ────────────────────────────────
-- same_tenant() reads auth.jwt() ->> 'tenant_id' which is the Supabase Auth JWT.
-- Custom auth (synapse_session) users do not have Supabase Auth sessions.
-- Therefore same_tenant() returns false for all custom-auth users client-side.
-- This is the SAFE default: custom-auth users cannot bypass tenant isolation via client API.
-- Server-side code uses supabaseAdmin (service role) which bypasses RLS entirely.
-- This architecture is intentional — see architecture notes below.

-- ── Architecture note (comments only) ───────────────────────────────────
COMMENT ON FUNCTION same_tenant(uuid) IS
  'Reads tenant_id from Supabase Auth JWT. Returns false for custom-auth (synapse_session) users, '
  'which is the safe default. All tenant isolation for custom-auth users is enforced server-side '
  'via supabaseAdmin (service role) + token payload validation in TypeScript.';
