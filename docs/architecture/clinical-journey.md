# Clinical journey — integrator map

Owner: **Clinical Journey agent**. Other specialty packs consume this map; they do not add department shells.

Status: **PLANNED** as an end-to-end operational journey. Do not add fake screens. Registry: `os/clinical_journey_e2e`.

Contracts to reuse (do not fork): `PersonIdentity`, `FacilityContext`, `Encounter`, `Condition`, `ServiceRequest`, `DiagnosticResult`, `MedicationRequest`, `MedicationDispense`, `TimelineEvent` — see `docs/architecture/contracts.md`.

## One journey

Registration → Queue → Triage → Consultation → ICD-11 diagnosis → Orders → Lab/imaging → Results → Prescription → Pharmacy → Billing → Discharge/referral → Follow-up

| Step | Existing surface | Maturity | Notes |
|---|---|---|---|
| Registration | `apps/web/src/app/os/[slug]/patients/` + `RegisterPatientForm.tsx`; facility `patients` + nullable `person_id` | PARTIAL | Must create/link `persons`, not treat MRN as the person |
| Queue | `apps/web/src/app/dept/opd/queue/page.tsx` | Placeholder ("Coming soon") | Do not build a second queue |
| Triage | `apps/web/src/app/api/opd/triage/route.ts`; A&E `dept/ae/triage` is placeholder | PARTIAL API / facade UI | Journey owns triage state on Encounter |
| Consultation | `os/[slug]/encounters/new` has an experimental ICD-11 copilot form; all 10 `doctor/*` and 7 `encounter/[id]/*` pages are placeholders | Facade | Signed note + Encounter contract required before claiming OPERATIONAL |
| ICD-11 diagnosis | Copilot differentials on new-encounter form; no terminology cache | Prototype | Server-side ICD-11 only — `docs/architecture/terminology-icd11.md` |
| Orders | `encounter/[id]/orders` placeholder; `ServiceRequest` type exists | PLANNED | Lab/imaging orders share one request model |
| Lab / imaging | 7 `lab/*` pages placeholder; specimen tables exist from identity foundations | PLANNED | Analyzers speak accession numbers |
| Results | Placeholder UIs; `DiagnosticResult` contract | PLANNED | Critical values need clinical-safety review |
| Prescription | `MedicationRequest` contract; doctor orders placeholder | PLANNED | Must round-trip to Pharm dispense |
| Pharmacy | Synapse Pharm POS / FEFO — OPERATIONAL online | OPERATIONAL (online) | Dispense publishes timeline when person/patient linked |
| Billing | Hospital admin finance pages exist; not closed-loop with encounter | PARTIAL | No duplicate charge capture in specialties |
| Discharge / referral | Doctor referrals + all `referral` routes are placeholders | PLANNED | Closed-loop later |
| Follow-up | Patient app appointments placeholder | PLANNED | Synapse App is the person channel |

## Integrator rules

1. The Clinical Journey agent owns wiring. Specialty agents (maternity, HIV, theatre, …) extend Encounter/Ward/Medication. They do not create `patients2` or extra timelines.
2. Placeholder counts to preserve: doctor 10, nurse 7, lab 7, encounter 7, patient 11, plus department facades. **Do not add more.**
3. Hospital admin has three competing shells (`/admin`, `/hospital/admin`, `/os/[slug]`). Journey work uses `/os/[slug]` as the facility workspace unless Core issues a new ADR.
4. Milestone A (Pharm offline) is not blocked on this journey. Journey must not edit inventory RPCs or the sync envelope.
