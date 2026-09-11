-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260605194536  name: seed_demo_lab_results_and_upsert_modules
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.


-- ============================================================
-- Seed demo_lab_results (realistic Uganda clinical data)
-- ============================================================

INSERT INTO demo_lab_results (id, patient_id, encounter_id, test_name, result_value, unit, status) VALUES
(gen_random_uuid(), 'b0000000-0001-0001-0001-000000000001', 'c0000000-0001-0001-0001-000000000001', 'Malaria RDT (P. falciparum)', 'Positive', NULL, 'final'),
(gen_random_uuid(), 'b0000000-0001-0001-0001-000000000001', 'c0000000-0001-0001-0001-000000000001', 'Haemoglobin', '9.2', 'g/dL', 'final'),
(gen_random_uuid(), 'b0000000-0001-0001-0001-000000000001', 'c0000000-0001-0001-0001-000000000001', 'Blood Glucose (Random)', '5.8', 'mmol/L', 'final'),
(gen_random_uuid(), 'b0000000-0001-0001-0001-000000000002', 'c0000000-0001-0001-0001-000000000002', 'Full Blood Count - WBC', '14.2', '×10⁹/L', 'final'),
(gen_random_uuid(), 'b0000000-0001-0001-0001-000000000002', 'c0000000-0001-0001-0001-000000000002', 'CRP', '68', 'mg/L', 'final'),
(gen_random_uuid(), 'b0000000-0001-0001-0001-000000000002', 'c0000000-0001-0001-0001-000000000002', 'Sputum AFB', 'Negative', NULL, 'final'),
(gen_random_uuid(), 'b0000000-0001-0001-0001-000000000004', 'c0000000-0001-0001-0001-000000000004', 'HIV Rapid Test', 'Positive', NULL, 'final'),
(gen_random_uuid(), 'b0000000-0001-0001-0001-000000000004', 'c0000000-0001-0001-0001-000000000004', 'CD4 Count', '320', 'cells/µL', 'final'),
(gen_random_uuid(), 'b0000000-0001-0001-0001-000000000004', 'c0000000-0001-0001-0001-000000000004', 'Viral Load', '45000', 'copies/mL', 'final'),
(gen_random_uuid(), 'b0000000-0001-0001-0001-000000000005', 'c0000000-0001-0001-0001-000000000005', 'Blood Group and Rh', 'O Positive', NULL, 'final'),
(gen_random_uuid(), 'b0000000-0001-0001-0001-000000000005', 'c0000000-0001-0001-0001-000000000005', 'Urinalysis Protein', 'Trace', NULL, 'final'),
(gen_random_uuid(), 'b0000000-0001-0001-0001-000000000005', 'c0000000-0001-0001-0001-000000000005', 'VDRL', 'Non-Reactive', NULL, 'final'),
(gen_random_uuid(), 'b0000000-0001-0001-0001-000000000006', 'c0000000-0001-0001-0001-000000000006', 'HbA1c', '8.9', '%', 'final'),
(gen_random_uuid(), 'b0000000-0001-0001-0001-000000000006', 'c0000000-0001-0001-0001-000000000006', 'Fasting Blood Glucose', '12.4', 'mmol/L', 'final'),
(gen_random_uuid(), 'b0000000-0001-0001-0001-000000000006', 'c0000000-0001-0001-0001-000000000006', 'Serum Creatinine', '128', 'µmol/L', 'final'),
(gen_random_uuid(), 'b0000000-0001-0001-0001-000000000007', 'c0000000-0001-0001-0001-000000000007', 'Widal Test S. typhi O', '1:160', NULL, 'final'),
(gen_random_uuid(), 'b0000000-0001-0001-0001-000000000007', 'c0000000-0001-0001-0001-000000000007', 'Liver Function ALT', '52', 'U/L', 'final');

-- ============================================================
-- Upsert hospital_modules (ON CONFLICT update is_active)
-- ============================================================

INSERT INTO hospital_modules (id, hospital_id, tenant_id, module_key, is_active, activated_at) VALUES
(gen_random_uuid(), '40b2a61f-a0d1-4f06-a0e3-72d87aad7bd5', '40b2a61f-a0d1-4f06-a0e3-72d87aad7bd5', 'administration', true, now()),
(gen_random_uuid(), '40b2a61f-a0d1-4f06-a0e3-72d87aad7bd5', '40b2a61f-a0d1-4f06-a0e3-72d87aad7bd5', 'front_desk', true, now()),
(gen_random_uuid(), '40b2a61f-a0d1-4f06-a0e3-72d87aad7bd5', '40b2a61f-a0d1-4f06-a0e3-72d87aad7bd5', 'opd', true, now()),
(gen_random_uuid(), '40b2a61f-a0d1-4f06-a0e3-72d87aad7bd5', '40b2a61f-a0d1-4f06-a0e3-72d87aad7bd5', 'pharmacy', true, now()),
(gen_random_uuid(), '40b2a61f-a0d1-4f06-a0e3-72d87aad7bd5', '40b2a61f-a0d1-4f06-a0e3-72d87aad7bd5', 'laboratory', true, now()),
(gen_random_uuid(), '40b2a61f-a0d1-4f06-a0e3-72d87aad7bd5', '40b2a61f-a0d1-4f06-a0e3-72d87aad7bd5', 'finance', true, now()),
(gen_random_uuid(), '40b2a61f-a0d1-4f06-a0e3-72d87aad7bd5', '40b2a61f-a0d1-4f06-a0e3-72d87aad7bd5', 'emergency', true, now()),
(gen_random_uuid(), '40b2a61f-a0d1-4f06-a0e3-72d87aad7bd5', '40b2a61f-a0d1-4f06-a0e3-72d87aad7bd5', 'maternity', true, now()),
(gen_random_uuid(), '40b2a61f-a0d1-4f06-a0e3-72d87aad7bd5', '40b2a61f-a0d1-4f06-a0e3-72d87aad7bd5', 'paediatrics', true, now()),
(gen_random_uuid(), '40b2a61f-a0d1-4f06-a0e3-72d87aad7bd5', '40b2a61f-a0d1-4f06-a0e3-72d87aad7bd5', 'hiv_art', true, now()),
(gen_random_uuid(), '40b2a61f-a0d1-4f06-a0e3-72d87aad7bd5', '40b2a61f-a0d1-4f06-a0e3-72d87aad7bd5', 'icu', true, now()),
(gen_random_uuid(), '40b2a61f-a0d1-4f06-a0e3-72d87aad7bd5', '40b2a61f-a0d1-4f06-a0e3-72d87aad7bd5', 'surgery_theatre', true, now()),
(gen_random_uuid(), '40b2a61f-a0d1-4f06-a0e3-72d87aad7bd5', '40b2a61f-a0d1-4f06-a0e3-72d87aad7bd5', 'insurance_copilot', true, now()),
(gen_random_uuid(), '40b2a61f-a0d1-4f06-a0e3-72d87aad7bd5', '40b2a61f-a0d1-4f06-a0e3-72d87aad7bd5', 'radiology', true, now()),
(gen_random_uuid(), '40b2a61f-a0d1-4f06-a0e3-72d87aad7bd5', '40b2a61f-a0d1-4f06-a0e3-72d87aad7bd5', 'telemedicine', true, now()),
(gen_random_uuid(), '40b2a61f-a0d1-4f06-a0e3-72d87aad7bd5', '40b2a61f-a0d1-4f06-a0e3-72d87aad7bd5', 'sdg_dashboard', true, now()),
(gen_random_uuid(), '40b2a61f-a0d1-4f06-a0e3-72d87aad7bd5', '40b2a61f-a0d1-4f06-a0e3-72d87aad7bd5', 'epidemiology', true, now()),
(gen_random_uuid(), '40b2a61f-a0d1-4f06-a0e3-72d87aad7bd5', '40b2a61f-a0d1-4f06-a0e3-72d87aad7bd5', 'dhis2_export', true, now()),
(gen_random_uuid(), '40b2a61f-a0d1-4f06-a0e3-72d87aad7bd5', '40b2a61f-a0d1-4f06-a0e3-72d87aad7bd5', 'cardiology', false, null),
(gen_random_uuid(), '40b2a61f-a0d1-4f06-a0e3-72d87aad7bd5', '40b2a61f-a0d1-4f06-a0e3-72d87aad7bd5', 'oncology', false, null),
(gen_random_uuid(), '40b2a61f-a0d1-4f06-a0e3-72d87aad7bd5', '40b2a61f-a0d1-4f06-a0e3-72d87aad7bd5', 'mental_health', false, null),
(gen_random_uuid(), '40b2a61f-a0d1-4f06-a0e3-72d87aad7bd5', '40b2a61f-a0d1-4f06-a0e3-72d87aad7bd5', 'renal_dialysis', false, null),
(gen_random_uuid(), '40b2a61f-a0d1-4f06-a0e3-72d87aad7bd5', '40b2a61f-a0d1-4f06-a0e3-72d87aad7bd5', 'care_home', false, null),
(gen_random_uuid(), '40b2a61f-a0d1-4f06-a0e3-72d87aad7bd5', '40b2a61f-a0d1-4f06-a0e3-72d87aad7bd5', 'community_health', false, null),
(gen_random_uuid(), '40b2a61f-a0d1-4f06-a0e3-72d87aad7bd5', '40b2a61f-a0d1-4f06-a0e3-72d87aad7bd5', 'teaching_hospital', false, null),
(gen_random_uuid(), '40b2a61f-a0d1-4f06-a0e3-72d87aad7bd5', '40b2a61f-a0d1-4f06-a0e3-72d87aad7bd5', 'device_integration', false, null),
(gen_random_uuid(), '40b2a61f-a0d1-4f06-a0e3-72d87aad7bd5', '40b2a61f-a0d1-4f06-a0e3-72d87aad7bd5', 'pharmacy_pos', false, null)
ON CONFLICT (hospital_id, module_key) DO UPDATE SET is_active = EXCLUDED.is_active, activated_at = EXCLUDED.activated_at;
