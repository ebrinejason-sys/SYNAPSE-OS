-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260504045522  name: fix_demo_rls_use_jwt_email
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.


-- Drop old subquery-based policies and replace with faster JWT email check
DROP POLICY IF EXISTS "demo_depts_rls" ON public.demo_departments;
DROP POLICY IF EXISTS "demo_patients_rls" ON public.demo_patients;
DROP POLICY IF EXISTS "demo_encounters_rls" ON public.demo_encounters;
DROP POLICY IF EXISTS "demo_vitals_rls" ON public.demo_vitals;
DROP POLICY IF EXISTS "demo_orders_rls" ON public.demo_encounter_orders;
DROP POLICY IF EXISTS "demo_lab_results_rls" ON public.demo_lab_results;

CREATE POLICY "demo_depts_rls" ON public.demo_departments FOR ALL
  USING ((auth.jwt() ->> 'email') = 'demo@synapseos.tech')
  WITH CHECK ((auth.jwt() ->> 'email') = 'demo@synapseos.tech');

CREATE POLICY "demo_patients_rls" ON public.demo_patients FOR ALL
  USING ((auth.jwt() ->> 'email') = 'demo@synapseos.tech')
  WITH CHECK ((auth.jwt() ->> 'email') = 'demo@synapseos.tech');

CREATE POLICY "demo_encounters_rls" ON public.demo_encounters FOR ALL
  USING ((auth.jwt() ->> 'email') = 'demo@synapseos.tech')
  WITH CHECK ((auth.jwt() ->> 'email') = 'demo@synapseos.tech');

CREATE POLICY "demo_vitals_rls" ON public.demo_vitals FOR ALL
  USING ((auth.jwt() ->> 'email') = 'demo@synapseos.tech')
  WITH CHECK ((auth.jwt() ->> 'email') = 'demo@synapseos.tech');

CREATE POLICY "demo_orders_rls" ON public.demo_encounter_orders FOR ALL
  USING ((auth.jwt() ->> 'email') = 'demo@synapseos.tech')
  WITH CHECK ((auth.jwt() ->> 'email') = 'demo@synapseos.tech');

CREATE POLICY "demo_lab_results_rls" ON public.demo_lab_results FOR ALL
  USING ((auth.jwt() ->> 'email') = 'demo@synapseos.tech')
  WITH CHECK ((auth.jwt() ->> 'email') = 'demo@synapseos.tech');
