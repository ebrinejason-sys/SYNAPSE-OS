\set ON_ERROR_STOP on
do $$
declare
  tenant_a uuid := gen_random_uuid();
  tenant_b uuid := gen_random_uuid();
  doctor_a uuid := gen_random_uuid();
  doctor_b uuid := gen_random_uuid();
  patient_a uuid := gen_random_uuid();
  patient_b uuid := gen_random_uuid();
  enc_a uuid := gen_random_uuid();
  enc_b uuid := gen_random_uuid();
  rejected_a uuid := gen_random_uuid();
  open_a uuid := gen_random_uuid();
  replacement uuid := gen_random_uuid();
  wrong_facility uuid := gen_random_uuid();
  dup1 uuid := gen_random_uuid();
  dup2 uuid := gen_random_uuid();
begin
  delete from lab_orders; delete from encounters; delete from patients;
  delete from profiles where email like '%@example.invalid';
  delete from tenants where environment = 'disposable-rc1';

  insert into tenants (id, name, facility_type, is_synthetic, environment, data_classification)
  values
    (tenant_a, 'Synthetic Hospital A', 'hospital', true, 'disposable-rc1', 'synthetic'),
    (tenant_b, 'Synthetic Hospital B', 'hospital', true, 'disposable-rc1', 'synthetic');
  insert into profiles (id, email, role, tenant_id, hospital_id, full_name) values
    (doctor_a, 'doctor-a@example.invalid', 'doctor', tenant_a, tenant_a, 'Doctor A'),
    (doctor_b, 'doctor-b@example.invalid', 'doctor', tenant_b, tenant_b, 'Doctor B');
  insert into patients (id, tenant_id, first_name, last_name, mrn, is_synthetic, data_classification) values
    (patient_a, tenant_a, 'Syn', 'PatientA', 'SYN-A-1', true, 'synthetic'),
    (patient_b, tenant_b, 'Syn', 'PatientB', 'SYN-B-1', true, 'synthetic');
  insert into encounters (id, tenant_id, patient_id, status, is_synthetic) values
    (enc_a, tenant_a, patient_a, 'in_progress', true),
    (enc_b, tenant_b, patient_b, 'in_progress', true);
  insert into lab_orders (id, tenant_id, encounter_id, patient_id, test_name, loinc_code, ordered_by, workflow_status, status, is_synthetic, correlation_id) values
    (rejected_a, tenant_a, enc_a, patient_a, 'Malaria Pf antigen', '58413-6', doctor_a, 'REJECTED', 'cancelled', true, enc_a),
    (open_a, tenant_a, enc_a, patient_a, 'Malaria Pf antigen', '58413-6', doctor_a, 'ORDERED', 'ordered', true, enc_a),
    (wrong_facility, tenant_b, enc_b, patient_b, 'Malaria Pf antigen', '58413-6', doctor_b, 'REJECTED', 'cancelled', true, enc_b);

  insert into lab_orders (id, tenant_id, encounter_id, patient_id, test_name, loinc_code, ordered_by, workflow_status, status, is_synthetic, correlation_id, replaces_lab_order_id)
  values (replacement, tenant_a, enc_a, patient_a, 'Malaria Pf antigen', '58413-6', doctor_a, 'ORDERED', 'ordered', true, enc_a, rejected_a);
  raise notice 'PASS happy_path_replacement_link';

  begin
    insert into lab_orders (id, tenant_id, encounter_id, patient_id, test_name, loinc_code, ordered_by, workflow_status, status, is_synthetic, correlation_id, replaces_lab_order_id)
    values (gen_random_uuid(), tenant_a, enc_a, patient_a, 'Malaria Pf antigen', '58413-6', doctor_a, 'ORDERED', 'ordered', true, enc_a, wrong_facility);
    raise notice 'NOTE db_fk_allows_cross_tenant_replaces_link';
  exception when others then
    raise notice 'PASS db_blocked_cross_tenant: %', sqlerrm;
  end;

  begin
    insert into lab_orders (id, tenant_id, encounter_id, patient_id, test_name, loinc_code, ordered_by, workflow_status, status, is_synthetic, correlation_id, replaces_lab_order_id)
    values (dup1, tenant_a, enc_a, patient_a, 'Malaria Pf antigen', '58413-6', doctor_a, 'ORDERED', 'ordered', true, enc_a, rejected_a);
    raise exception 'FAIL expected unique open replacement to block dup';
  exception when unique_violation then
    raise notice 'PASS unique_blocks_duplicate_open_replacement';
  end;

  begin
    insert into lab_orders (id, tenant_id, encounter_id, patient_id, test_name, loinc_code, ordered_by, workflow_status, status, is_synthetic, correlation_id, replaces_lab_order_id)
    values (gen_random_uuid(), tenant_a, enc_a, patient_a, 'Malaria Pf antigen', '58413-6', doctor_a, 'ORDERED', 'ordered', true, enc_a, open_a);
    raise notice 'NOTE db_allows_replace_of_non_rejected — API must 400';
  exception when others then
    raise notice 'PASS db_blocked_non_rejected: %', sqlerrm;
  end;

  raise notice 'SQL_LAYER_COMPLETE';
end $$;
