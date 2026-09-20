-- Drop permissive app_rw_* policies that treat any Supabase Auth JWT with
-- auth.role() = 'authenticated' as globally authorized for ALL on clinical tables.
-- These are POLICY names, not Postgres roles. They OR-bypass tenant_isolation
-- because every app_rw_* policy is PERMISSIVE.
--
-- Trusted backend access remains service_role (BYPASSRLS) via supabaseAdmin in
-- server routes, which must continue to filter tenant_id in application code.
-- Client/Data API identities (anon, authenticated) must not cross tenants.

DROP POLICY IF EXISTS "app_rw_billing_invoices" ON public.billing_invoices;
DROP POLICY IF EXISTS "app_rw_billing_line_items" ON public.billing_line_items;
DROP POLICY IF EXISTS "app_rw_cds_alerts" ON public.cds_alerts;
DROP POLICY IF EXISTS "app_rw_cds_rules" ON public.cds_rules;
DROP POLICY IF EXISTS "app_rw_departments" ON public.departments;
DROP POLICY IF EXISTS "app_rw_diagnoses" ON public.diagnoses;
DROP POLICY IF EXISTS "app_rw_encounter_diagnoses" ON public.encounter_diagnoses;
DROP POLICY IF EXISTS "app_rw_encounter_orders" ON public.encounter_orders;
DROP POLICY IF EXISTS "app_rw_encounters" ON public.encounters;
DROP POLICY IF EXISTS "app_rw_hospital_drug_orders" ON public.hospital_drug_orders;
DROP POLICY IF EXISTS "app_rw_hospital_settings" ON public.hospital_settings;
DROP POLICY IF EXISTS "app_rw_immunization_schedule" ON public.immunization_schedule;
DROP POLICY IF EXISTS "app_rw_inventory_items" ON public.inventory_items;
DROP POLICY IF EXISTS "app_rw_lab_results" ON public.lab_results;
DROP POLICY IF EXISTS "app_rw_loinc_reference" ON public.loinc_reference;
DROP POLICY IF EXISTS "app_rw_maternity_records" ON public.maternity_records;
DROP POLICY IF EXISTS "app_rw_order_mappings" ON public.order_mappings;
DROP POLICY IF EXISTS "app_rw_patient_billing" ON public.patient_billing;
DROP POLICY IF EXISTS "app_rw_patient_safety_events" ON public.patient_safety_events;
DROP POLICY IF EXISTS "app_rw_patients" ON public.patients;
DROP POLICY IF EXISTS "app_rw_pharmacy_stores" ON public.pharmacy_stores;
DROP POLICY IF EXISTS "app_rw_radiology_reports" ON public.radiology_reports;
DROP POLICY IF EXISTS "app_rw_service_catalog" ON public.service_catalog;
DROP POLICY IF EXISTS "app_rw_vitals" ON public.vitals;
