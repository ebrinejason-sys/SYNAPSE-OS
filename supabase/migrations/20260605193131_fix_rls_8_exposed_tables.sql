-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260605193131  name: fix_rls_8_exposed_tables
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.


-- ============================================================
-- FIX: Enable RLS + policies on 8 exposed tables
-- Column names verified against actual schema
-- ============================================================

-- 1. patient_profiles (PHI — no user_id, uses hospital_id)
ALTER TABLE public.patient_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON public.patient_profiles
  FOR ALL USING (
    hospital_id = (SELECT p.hospital_id FROM profiles p WHERE p.id = auth.uid() LIMIT 1)
  );

CREATE POLICY "platform_admin_bypass" ON public.patient_profiles
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin')
  );

-- 2. patient_vitals (PHI — no tenant_id, links via patient_id)
ALTER TABLE public.patient_vitals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hospital_isolation" ON public.patient_vitals
  FOR ALL USING (
    patient_id IN (
      SELECT pp.id FROM patient_profiles pp
      WHERE pp.hospital_id = (SELECT p.hospital_id FROM profiles p WHERE p.id = auth.uid() LIMIT 1)
    )
  );

CREATE POLICY "platform_admin_bypass" ON public.patient_vitals
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin')
  );

-- 3. wards (uses hospital_id, no tenant_id)
ALTER TABLE public.wards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON public.wards
  FOR ALL USING (
    hospital_id = (SELECT p.hospital_id FROM profiles p WHERE p.id = auth.uid() LIMIT 1)
  );

CREATE POLICY "platform_admin_bypass" ON public.wards
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin')
  );

-- 4. tenants (users see their own tenant)
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON public.tenants
  FOR ALL USING (
    id = (SELECT p.tenant_id FROM profiles p WHERE p.id = auth.uid() LIMIT 1)
  );

CREATE POLICY "platform_admin_bypass" ON public.tenants
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin')
  );

-- 5. passport_share_tokens (uses created_by + synapse_id)
ALTER TABLE public.passport_share_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_access" ON public.passport_share_tokens
  FOR ALL USING (created_by = auth.uid());

CREATE POLICY "platform_admin_bypass" ON public.passport_share_tokens
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin')
  );

-- Allow token validation by anyone (for QR scanning)
CREATE POLICY "anon_validate" ON public.passport_share_tokens
  FOR SELECT USING (
    is_revoked = false AND expires_at > now() AND use_count < max_uses
  );

-- 6. passport_access_log (uses accessed_by_user_id)
ALTER TABLE public.passport_access_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_access_log" ON public.passport_access_log
  FOR SELECT USING (accessed_by_user_id = auth.uid());

CREATE POLICY "insert_on_access" ON public.passport_access_log
  FOR INSERT WITH CHECK (true);

CREATE POLICY "platform_admin_bypass" ON public.passport_access_log
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin')
  );

-- 7. apk_waitlist (public insert, admin read)
ALTER TABLE public.apk_waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_insert" ON public.apk_waitlist
  FOR INSERT WITH CHECK (true);

CREATE POLICY "platform_admin_read" ON public.apk_waitlist
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin')
  );

-- 8. live_feed_sessions (has tenant_id)
ALTER TABLE public.live_feed_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON public.live_feed_sessions
  FOR ALL USING (
    tenant_id = (SELECT p.tenant_id FROM profiles p WHERE p.id = auth.uid() LIMIT 1)
  );

CREATE POLICY "platform_admin_bypass" ON public.live_feed_sessions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin')
  );
