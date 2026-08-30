# Hospital Event Matrix — 2026-08-30

Domain events for hospital acceptance. Source of truth: `packages/interop/src/events.ts`.

## Registration

| Event | Producer | Consumer(s) | Source table | FHIR | Idempotency |
|---|---|---|---|---|---|
| PatientRegistered | Registration API | Timeline, MPI | patients, persons | Patient | patient_id + tenant_id |

## Triage

| Event | Producer | Consumer(s) | Source table | FHIR | Idempotency |
|---|---|---|---|---|---|
| ObservationRecorded | Triage API | Pathways, Timeline | vitals | Observation | encounter_id + recorded_at |
| TriageCompleted | Triage service | OPD queue | encounters | Encounter | encounter_id |
| PatientQueued | Queue service | OPD display | consult_queue | — | queue_token |

## Clinical

| Event | Producer | Consumer(s) | Source table | FHIR | Idempotency |
|---|---|---|---|---|---|
| EncounterCreated | OPD/Triage API | Timeline, Billing | encounters | Encounter | encounter_id |
| EncounterSigned | Clinician workspace | Timeline, HIM | encounters | Encounter | encounter_id + signed_at |
| DiagnosisConfirmed | Clinician/ICD-11 | Pathways, Timeline | encounter_diagnoses | Condition | encounter_id + icd_code |

## Pathways

| Event | Producer | Consumer(s) | Source table | FHIR | Idempotency |
|---|---|---|---|---|---|
| ClinicalPathwayStarted | PathwayRuntime | Lab, Pharm, Timeline | patient_pathways | CarePlan | pathway_id |
| ClinicalPathwayStepCompleted | PathwayRuntime | Orders, Timeline | pathway_checklist_items | — | pathway_id + step_id |
| ClinicalPathwayOverridden | Clinician | Audit, Timeline | pathway_overrides | — | override_id |
| ClinicalPathwayCompleted | PathwayRuntime | Timeline | patient_pathways | CarePlan | pathway_id |

## Laboratory

| Event | Producer | Consumer(s) | Source table | FHIR | Idempotency |
|---|---|---|---|---|---|
| LabOrderCreated | Clinician/WorkQueue | Lab worklist | lab_orders | ServiceRequest | order_id |
| SpecimenCollected | Phlebotomist | Lab reception | lab_specimens | Specimen | specimen_id |
| SpecimenReceived | Lab reception | Processing | lab_specimens | Specimen | specimen_id + received_at |
| SpecimenRejected | Lab reception | Clinician notify | lab_specimens | Specimen | specimen_id |
| LabResultEntered | Lab technician | Verification queue | lab_results | Observation | result_id |
| LabResultVerified | Lab scientist | Clinician, Pathways | lab_results | DiagnosticReport | result_id + verified_at |
| LabResultReleased | Lab scientist | Clinician, Timeline | lab_results | DiagnosticReport | result_id + released_at |
| LabResultAmended | Lab scientist | Timeline, Audit | lab_result_amendments | DiagnosticReport | amendment_id |
| CriticalLabResultDetected | LabWorkflow | Clinician alert | lab_results | Observation | result_id |
| CriticalLabResultAcknowledged | Clinician | Audit | lab_critical_acknowledgements | — | ack_id |

## Imaging

| Event | Producer | Consumer(s) | Source table | FHIR | Idempotency |
|---|---|---|---|---|---|
| ImagingOrderCreated | Clinician/WorkQueue | Radiology worklist | — (NOT_IMPLEMENTED) | ServiceRequest | order_id |
| ImagingReportFinalized | Radiologist | Timeline, Clinician | — (NOT_IMPLEMENTED) | DiagnosticReport | report_id |

## Pharmacy

| Event | Producer | Consumer(s) | Source table | FHIR | Idempotency |
|---|---|---|---|---|---|
| PrescriptionCreated | Clinician | Pharmacy queue | clinical_prescriptions | MedicationRequest | prescription_id |
| PrescriptionVerified | Pharmacist | Dispense queue | clinical_prescriptions | MedicationRequest | prescription_id + verified_at |
| MedicationDispensed | Pharmacist | Timeline, Inventory | pharmacy dispense | MedicationDispense | dispense_id |
| MedicationReturned | Pharmacist | Inventory, Timeline | — | MedicationDispense | return_id |

## Inpatient

| Event | Producer | Consumer(s) | Source table | FHIR | Idempotency |
|---|---|---|---|---|---|
| PatientAdmitted | Admission service | Ward, Billing | hospital_beds | Encounter | admission_id |
| PatientTransferred | Transfer service | Ward, Timeline | hospital_beds | Encounter | transfer_id |
| PatientDischarged | Discharge service | Billing, Timeline | encounters | Encounter | discharge_id |

## Finance

| Event | Producer | Consumer(s) | Source table | FHIR | Idempotency |
|---|---|---|---|---|---|
| InvoiceCreated | Billing service | Cashier | billing_invoices | Invoice | invoice_id |
| PaymentRecorded | Cashier | Timeline, Audit | — | PaymentNotice | payment_id + idempotency_key |
| ClaimSubmitted | Insurance officer | Insurer adapter | insurance_claims | Claim | claim_id |
| ClaimRejected | Insurer | Insurance officer | insurance_claims | ClaimResponse | claim_id + rejection_id |
| ClaimPaid | Insurer | Timeline | insurance_claims | ClaimResponse | claim_id + payment_id |

## Referral

| Event | Producer | Consumer(s) | Source table | FHIR | Idempotency |
|---|---|---|---|---|---|
| ReferralCreated | Clinician | Referral office | facility_referrals | ServiceRequest | referral_id |
| ReferralAccepted | Referral coordinator | Clinical transfer | facility_referrals | — | referral_id + accepted_at |
| ReferralCompleted | Referral coordinator | Timeline | facility_referrals | — | referral_id + completed_at |

## WorkQueue (new — department_tasks)

| Event | Producer | Consumer(s) | Source table | FHIR | Idempotency |
|---|---|---|---|---|---|
| Task routing | WorkQueue.create | Department worklist | department_tasks | Task | idempotency_key |
| Task completion | WorkQueue.complete | Source module, Timeline | department_tasks | Task | task_id + completed_at |

## Failure policy

All events: fail closed on duplicate idempotency_key (return existing, do not re-emit).  
Retry: Exchange outbox with exponential backoff; dead-letter after max retries.  
Synthetic classification: all demo hospital events carry `is_synthetic: true` in payload.
