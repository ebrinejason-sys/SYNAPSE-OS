-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260605194359  name: add_tenant_id_indexes_all_70_tables
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.


-- ============================================================
-- tenant_id indexes on all 70 tables missing them
-- Critical for RLS query performance at scale
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_aefi_reports_tid ON public.aefi_reports(tenant_id);
CREATE INDEX IF NOT EXISTS idx_allergens_catalog_tid ON public.allergens_catalog(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_tid ON public.audit_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_beta_access_requests_tid ON public.beta_access_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_chw_visits_tid ON public.chw_visits(tenant_id);
CREATE INDEX IF NOT EXISTS idx_claim_resubmissions_tid ON public.claim_resubmissions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_clinical_pathway_templates_tid ON public.clinical_pathway_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_community_health_workers_tid ON public.community_health_workers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_data_breach_incidents_tid ON public.data_breach_incidents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_data_export_jobs_tid ON public.data_export_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_data_retention_policies_tid ON public.data_retention_policies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_death_registrations_tid ON public.death_registrations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_death_reports_tid ON public.death_reports(tenant_id);
CREATE INDEX IF NOT EXISTS idx_deidentification_profiles_tid ON public.deidentification_profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_denial_analytics_daily_tid ON public.denial_analytics_daily(tenant_id);
CREATE INDEX IF NOT EXISTS idx_drug_contraindications_tid ON public.drug_contraindications(tenant_id);
CREATE INDEX IF NOT EXISTS idx_drug_dose_adjustments_tid ON public.drug_dose_adjustments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_drug_interactions_catalog_tid ON public.drug_interactions_catalog(tenant_id);
CREATE INDEX IF NOT EXISTS idx_expert_rules_tid ON public.expert_rules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_gas_cylinders_tid ON public.gas_cylinders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_handover_shift_tasks_tid ON public.handover_shift_tasks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_handover_signatures_tid ON public.handover_signatures(tenant_id);
CREATE INDEX IF NOT EXISTS idx_health_bulletins_tid ON public.health_bulletins(tenant_id);
CREATE INDEX IF NOT EXISTS idx_imaging_series_tid ON public.imaging_series(tenant_id);
CREATE INDEX IF NOT EXISTS idx_immunization_schedule_tid ON public.immunization_schedule(tenant_id);
CREATE INDEX IF NOT EXISTS idx_import_batch_rows_tid ON public.import_batch_rows(tenant_id);
CREATE INDEX IF NOT EXISTS idx_import_batches_tid ON public.import_batches(tenant_id);
CREATE INDEX IF NOT EXISTS idx_import_column_mappings_tid ON public.import_column_mappings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_loinc_reference_tid ON public.loinc_reference(tenant_id);
CREATE INDEX IF NOT EXISTS idx_maternity_records_tid ON public.maternity_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_medical_devices_tid ON public.medical_devices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_nin_access_log_tid ON public.nin_access_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_order_mappings_tid ON public.order_mappings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_outreach_campaigns_tid ON public.outreach_campaigns(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pathway_alerts_tid ON public.pathway_alerts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pathway_checklist_items_tid ON public.pathway_checklist_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_patient_access_grants_tid ON public.patient_access_grants(tenant_id);
CREATE INDEX IF NOT EXISTS idx_patient_billing_tid ON public.patient_billing(tenant_id);
CREATE INDEX IF NOT EXISTS idx_patient_problem_list_tid ON public.patient_problem_list(tenant_id);
CREATE INDEX IF NOT EXISTS idx_patient_safety_events_tid ON public.patient_safety_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_patient_sms_reminders_tid ON public.patient_sms_reminders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_patient_timeline_pins_tid ON public.patient_timeline_pins(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payer_contracts_tid ON public.payer_contracts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pediatric_growth_records_tid ON public.pediatric_growth_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pharmacy_stores_tid ON public.pharmacy_stores(tenant_id);
CREATE INDEX IF NOT EXISTS idx_products_tid ON public.products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_provider_verification_checks_tid ON public.provider_verification_checks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_tid ON public.purchase_orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_radiology_report_templates_tid ON public.radiology_report_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_renal_adjustments_catalog_tid ON public.renal_adjustments_catalog(tenant_id);
CREATE INDEX IF NOT EXISTS idx_restaurants_tid ON public.restaurants(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rule_executions_tid ON public.rule_executions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_service_catalog_tid ON public.service_catalog(tenant_id);
CREATE INDEX IF NOT EXISTS idx_staff_attendance_tid ON public.staff_attendance(tenant_id);
CREATE INDEX IF NOT EXISTS idx_staff_leave_requests_tid ON public.staff_leave_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_tid ON public.suppliers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sync_conflicts_tid ON public.sync_conflicts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sync_idempotency_keys_tid ON public.sync_idempotency_keys(tenant_id);
CREATE INDEX IF NOT EXISTS idx_telemedicine_followups_tid ON public.telemedicine_followups(tenant_id);
CREATE INDEX IF NOT EXISTS idx_telemedicine_frontdesk_queue_tid ON public.telemedicine_frontdesk_queue(tenant_id);
CREATE INDEX IF NOT EXISTS idx_telemedicine_intake_messages_tid ON public.telemedicine_intake_messages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_telemedicine_providers_tid ON public.telemedicine_providers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_telemedicine_session_events_tid ON public.telemedicine_session_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_telemedicine_staff_alerts_tid ON public.telemedicine_staff_alerts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_telemedicine_voice_memos_tid ON public.telemedicine_voice_memos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_domains_tid ON public.tenant_domains(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_logging_policies_tid ON public.tenant_logging_policies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_provisioning_jobs_tid ON public.tenant_provisioning_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ucg_guidelines_tid ON public.ucg_guidelines(tenant_id);
CREATE INDEX IF NOT EXISTS idx_verification_documents_tid ON public.verification_documents(tenant_id);
