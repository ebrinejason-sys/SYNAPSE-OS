-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260605193303  name: seed_demo_labs_and_modules
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.


-- ============================================================
-- SEED: demo_lab_results + hospital_modules
-- Column names verified: demo_lab_results(id,encounter_id,patient_id,test_name,result_value,unit,status,created_at)
-- hospital_modules(id,hospital_id,tenant_id,module_key,is_active,activated_at,created_at)
-- ============================================================

DO $$
DECLARE
  v_hospital_id UUID;
  v_tenant_id UUID;
  rec RECORD;
BEGIN
  SELECT id INTO v_hospital_id FROM hospitals LIMIT 1;
  SELECT id INTO v_tenant_id FROM tenants LIMIT 1;

  -- Seed demo_lab_results from demo_encounters
  FOR rec IN (SELECT id as enc_id, patient_id FROM demo_encounters LIMIT 11)
  LOOP
    INSERT INTO demo_lab_results (id, encounter_id, patient_id, test_name, result_value, unit, status, created_at)
    VALUES (gen_random_uuid(), rec.enc_id, rec.patient_id,
      CASE (random()*6)::int
        WHEN 0 THEN 'Malaria RDT (Pf)'
        WHEN 1 THEN 'Full Blood Count - WBC'
        WHEN 2 THEN 'Blood Glucose (Fasting)'
        WHEN 3 THEN 'HIV Rapid Test'
        WHEN 4 THEN 'Urinalysis - Protein'
        WHEN 5 THEN 'Widal Test (Typhoid O)'
        ELSE 'Serum Creatinine'
      END,
      CASE (random()*6)::int
        WHEN 0 THEN 'Positive'
        WHEN 1 THEN '15.2'
        WHEN 2 THEN '14.2'
        WHEN 3 THEN 'Non-reactive'
        WHEN 4 THEN '2+'
        WHEN 5 THEN '1:320'
        ELSE '2.8'
      END,
      CASE (random()*6)::int
        WHEN 0 THEN ''
        WHEN 1 THEN '×10⁹/L'
        WHEN 2 THEN 'mmol/L'
        WHEN 3 THEN ''
        WHEN 4 THEN ''
        WHEN 5 THEN ''
        ELSE 'mg/dL'
      END,
      CASE (random()*3)::int
        WHEN 0 THEN 'normal'
        WHEN 1 THEN 'abnormal'
        ELSE 'critical'
      END,
      now() - (random() * interval '48 hours')
    );
  END LOOP;

  -- Seed hospital_modules (22 modules for demo hospital)
  INSERT INTO hospital_modules (id, hospital_id, tenant_id, module_key, is_active, activated_at, created_at)
  VALUES
    (gen_random_uuid(), v_hospital_id, v_tenant_id, 'opd', true, now(), now()),
    (gen_random_uuid(), v_hospital_id, v_tenant_id, 'emergency', true, now(), now()),
    (gen_random_uuid(), v_hospital_id, v_tenant_id, 'maternity', true, now(), now()),
    (gen_random_uuid(), v_hospital_id, v_tenant_id, 'paediatrics', true, now(), now()),
    (gen_random_uuid(), v_hospital_id, v_tenant_id, 'hiv_art', true, now(), now()),
    (gen_random_uuid(), v_hospital_id, v_tenant_id, 'icu', false, NULL, now()),
    (gen_random_uuid(), v_hospital_id, v_tenant_id, 'surgery_theatre', false, NULL, now()),
    (gen_random_uuid(), v_hospital_id, v_tenant_id, 'cardiology', false, NULL, now()),
    (gen_random_uuid(), v_hospital_id, v_tenant_id, 'oncology', false, NULL, now()),
    (gen_random_uuid(), v_hospital_id, v_tenant_id, 'mental_health', true, now(), now()),
    (gen_random_uuid(), v_hospital_id, v_tenant_id, 'renal_dialysis', false, NULL, now()),
    (gen_random_uuid(), v_hospital_id, v_tenant_id, 'pharmacy', true, now(), now()),
    (gen_random_uuid(), v_hospital_id, v_tenant_id, 'laboratory', true, now(), now()),
    (gen_random_uuid(), v_hospital_id, v_tenant_id, 'radiology', false, NULL, now()),
    (gen_random_uuid(), v_hospital_id, v_tenant_id, 'insurance_copilot', true, now(), now()),
    (gen_random_uuid(), v_hospital_id, v_tenant_id, 'telemedicine', true, now(), now()),
    (gen_random_uuid(), v_hospital_id, v_tenant_id, 'community_health', false, NULL, now()),
    (gen_random_uuid(), v_hospital_id, v_tenant_id, 'teaching_hospital', false, NULL, now()),
    (gen_random_uuid(), v_hospital_id, v_tenant_id, 'sdg_dashboard', true, now(), now()),
    (gen_random_uuid(), v_hospital_id, v_tenant_id, 'epidemiology', true, now(), now()),
    (gen_random_uuid(), v_hospital_id, v_tenant_id, 'dhis2_export', false, NULL, now()),
    (gen_random_uuid(), v_hospital_id, v_tenant_id, 'device_integration', false, NULL, now())
  ON CONFLICT DO NOTHING;

END $$;
