-- Migration: fix_zero_policy_tables
-- Adds RLS policies to 13 tables that had RLS enabled but zero policies.
-- Depends on: current_tenant_id(), is_platform_admin() helpers (migration 20260612000003)

-- auth_otps: read-own for auditability (service role handles writes)
CREATE POLICY "auth_otps_own_read" ON auth_otps
  FOR SELECT USING (target = (SELECT email FROM profiles WHERE id = auth.uid() LIMIT 1));

-- mfa_enrollments
CREATE POLICY "mfa_own_all" ON mfa_enrollments
  FOR ALL USING (user_id = auth.uid());

-- health_bulletins
CREATE POLICY "health_bulletins_auth_read" ON health_bulletins
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "health_bulletins_admin_write" ON health_bulletins
  FOR ALL USING (is_platform_admin());

-- drug_shortage_alerts
CREATE POLICY "drug_shortage_read" ON drug_shortage_alerts
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "drug_shortage_admin_write" ON drug_shortage_alerts
  FOR ALL USING (is_platform_admin() OR
    EXISTS(SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'hospital_admin'));

-- refill_reminders
CREATE POLICY "refill_tenant" ON refill_reminders
  FOR ALL USING (tenant_id = current_tenant_id() OR is_platform_admin());

-- body_register
CREATE POLICY "body_register_tenant" ON body_register
  FOR ALL USING (tenant_id = current_tenant_id() OR is_platform_admin());

-- housekeeping_tasks
CREATE POLICY "housekeeping_tenant" ON housekeeping_tasks
  FOR ALL USING (tenant_id = current_tenant_id());

-- partograph_records
CREATE POLICY "partograph_tenant" ON partograph_records
  FOR ALL USING (tenant_id = current_tenant_id() OR is_platform_admin());

-- facility_resource_logs (uses hospital_id, not tenant_id)
CREATE POLICY "facility_resource_tenant" ON facility_resource_logs
  FOR ALL USING (hospital_id = current_tenant_id());

-- visitor_log
CREATE POLICY "visitor_log_tenant" ON visitor_log
  FOR ALL USING (tenant_id = current_tenant_id());

-- surveillance_reports
CREATE POLICY "surveillance_read" ON surveillance_reports
  FOR SELECT USING (tenant_id = current_tenant_id() OR is_platform_admin());
CREATE POLICY "surveillance_insert" ON surveillance_reports
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());

-- sdg_reports
CREATE POLICY "sdg_platform_admin" ON sdg_reports
  FOR ALL USING (is_platform_admin());

-- newsletter_subscribers
CREATE POLICY "newsletter_public_insert" ON newsletter_subscribers
  FOR INSERT WITH CHECK (true);
CREATE POLICY "newsletter_admin_read" ON newsletter_subscribers
  FOR SELECT USING (is_platform_admin());
