-- Simulation mappings for aggregate export. Replace UIDs with MoH-approved
-- values before enabling live DHIS2 delivery.
INSERT INTO public.dhis2_data_element_mappings
  (tenant_id, icd11_stem_code, dhis2_data_element_id, display_name, hmis_code)
VALUES
  (NULL, '1F40', 'DE_MALARIA', 'Malaria', 'MALARIA'),
  (NULL, 'CA40', 'DE_PNEUMONIA', 'Pneumonia', 'PNEUMONIA'),
  (NULL, '1B10', 'DE_PULMONARY_TB', 'Tuberculosis', 'TB'),
  (NULL, '1G40', 'DE_SEPSIS', 'Sepsis', 'SEPSIS'),
  (NULL, '1A07', 'DE_TYPHOID', 'Typhoid fever', 'TYPHOID'),
  (NULL, '1C62', 'DE_HIV_DISEASE', 'HIV disease', 'HIV'),
  (NULL, 'BA00', 'DE_HYPERTENSION', 'Essential hypertension', 'HTN'),
  (NULL, '5A21', 'DE_DIABETES', 'Diabetic ketoacidosis', 'DIABETES')
ON CONFLICT (COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), icd11_stem_code) DO UPDATE
SET dhis2_data_element_id = EXCLUDED.dhis2_data_element_id,
    display_name = EXCLUDED.display_name,
    hmis_code = EXCLUDED.hmis_code;
