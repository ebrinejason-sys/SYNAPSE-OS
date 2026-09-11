-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260605193214  name: add_tenant_id_indexes_batch
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.


-- ============================================================
-- ADD: tenant_id indexes on 42 high-traffic tables
-- Accelerates RLS tenant_isolation policy from scan → index lookup
-- ============================================================

-- Clinical
CREATE INDEX IF NOT EXISTS idx_encounter_orders_tid ON public.encounter_orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_encounter_diagnoses_tid ON public.encounter_diagnoses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_lab_results_tid ON public.lab_results(tenant_id);
CREATE INDEX IF NOT EXISTS idx_diagnoses_tid ON public.diagnoses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_patient_notes_tid ON public.patient_notes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hospital_drug_orders_tid ON public.hospital_drug_orders(tenant_id);

-- Billing
CREATE INDEX IF NOT EXISTS idx_billing_invoices_tid ON public.billing_invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_billing_line_items_tid ON public.billing_line_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_claim_line_items_tid ON public.claim_line_items(tenant_id);

-- Orders & inventory
CREATE INDEX IF NOT EXISTS idx_orders_tid ON public.orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_order_items_tid ON public.order_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_tid ON public.inventory_items(tenant_id);

-- Devices
CREATE INDEX IF NOT EXISTS idx_device_readings_tid ON public.device_readings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_device_alerts_tid ON public.device_alerts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_scan_events_tid ON public.scan_events(tenant_id);

-- Pharmacy
CREATE INDEX IF NOT EXISTS idx_medication_safety_checks_tid ON public.medication_safety_checks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_drug_interactions_tid ON public.drug_interactions(tenant_id);

-- Care & handovers
CREATE INDEX IF NOT EXISTS idx_care_team_handovers_tid ON public.care_team_handovers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_handover_patient_entries_tid ON public.handover_patient_entries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bed_assignments_tid ON public.bed_assignments(tenant_id);

-- Telemedicine
CREATE INDEX IF NOT EXISTS idx_telemedicine_appointments_tid ON public.telemedicine_appointments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_telemedicine_intake_cases_tid ON public.telemedicine_intake_cases(tenant_id);

-- Audit & compliance
CREATE INDEX IF NOT EXISTS idx_consent_audit_log_tid ON public.consent_audit_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_phi_access_log_tid ON public.phi_access_log(tenant_id);

-- Public health
CREATE INDEX IF NOT EXISTS idx_surveillance_reports_tid ON public.surveillance_reports(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sentinel_alerts_tid ON public.sentinel_alerts(tenant_id);

-- Patient management
CREATE INDEX IF NOT EXISTS idx_patient_allergies_tid ON public.patient_allergies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_patient_consents_tid ON public.patient_consents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_patient_timeline_events_tid ON public.patient_timeline_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_patient_pathways_tid ON public.patient_pathways(tenant_id);
CREATE INDEX IF NOT EXISTS idx_referral_requests_tid ON public.referral_requests(tenant_id);

-- Imaging
CREATE INDEX IF NOT EXISTS idx_imaging_studies_tid ON public.imaging_studies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_radiology_reports_tid ON public.radiology_reports(tenant_id);

-- Surgery
CREATE INDEX IF NOT EXISTS idx_surgery_schedules_tid ON public.surgery_schedules(tenant_id);

-- CDS
CREATE INDEX IF NOT EXISTS idx_cds_alerts_tid ON public.cds_alerts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cds_rules_tid ON public.cds_rules(tenant_id);

-- Hospital config
CREATE INDEX IF NOT EXISTS idx_departments_tid ON public.departments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hospital_beds_tid ON public.hospital_beds(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hospital_modules_tid ON public.hospital_modules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hospital_settings_tid ON public.hospital_settings(tenant_id);

-- Live feed
CREATE INDEX IF NOT EXISTS idx_live_feed_sessions_tid ON public.live_feed_sessions(tenant_id);
