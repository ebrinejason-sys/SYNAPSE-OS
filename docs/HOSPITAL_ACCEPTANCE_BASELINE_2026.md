# Hospital Acceptance Baseline — 2026-08-30

**Repository:** `ebrinejason-sys/SYNAPSE-OS`  
**Base commit:** `75b6958` (Test Center + malaria golden journey)  
**Method:** Code, migrations, generated types, routes, APIs, and docs. Documentation may be stale; code is authoritative.

## Classification key

| Label | Meaning |
|---|---|
| OPERATIONAL | Implemented, tested, safe in constrained live setting |
| PARTIAL | Meaningful behaviour; journey incomplete |
| PROTOTYPE | Demonstrates idea; not production-ready |
| PLACEHOLDER | Coming soon / empty route |
| NOT_IMPLEMENTED | Designed or referenced; no working code |
| BROKEN | Exists but fails or calls retired endpoints |
| UNSAFE | Can cause clinical, financial, or privacy harm |

---

## Executive summary

SYNAPSE has strong **platform infrastructure** (Exchange events, Lab state machine, Pathways runtime, ICD-11, Intelligence kernel, malaria golden journey, Test Center) but a **thin hospital shell**. The tenant portal at `/os/[slug]` is the only cohesive clinical surface. Department routes (`/doctor`, `/nurse`, `/lab`, `/consults`) are overwhelmingly placeholder stubs. Backend APIs for OPD triage, AI, lab simulation, and pharmacy inventory exist but are **not connected** into end-to-end clinical journeys except via Platform Test Center synthetic runs.

**Critical gaps:**
1. No unified interdepartment Task/WorkQueue abstraction
2. `/os/[slug]/encounters/new` calls retired `POST /api/encounters` (410 Gone)
3. No facility_locations table — locations encoded as free text or ward strings
4. Doctor orders do not create lab tasks or pharmacy queue entries
5. Inpatient admission → ward → transfer → discharge chain incomplete
6. Imaging workflow absent beyond event type definitions
7. Blood bank NOT_IMPLEMENTED
8. Hospital subdomain routing breaks department routes

---

## Department baseline matrix

| # | Department | Classification | Pages | APIs | Events | RBAC | Tests |
|---|---|---|---|---|---|---|---|
| 1 | Reception / Registration | **PARTIAL** | `/os/[slug]/patients`, RegisterPatientForm | `POST /api/patients/register`, `GET /api/patients/search` | `PatientRegistered` (partial) | `patient.register` seeded | No E2E |
| 2 | Triage | **PARTIAL** | None dedicated | `POST /api/opd/triage` | `ObservationRecorded`, `TriageCompleted` (types only) | `triage.assign` seeded | No UI |
| 3 | Outpatient (OPD) | **PARTIAL** | `/os/[slug]/encounters/new` **BROKEN** | `GET /api/opd/queue`, `POST /api/opd/triage` | `EncounterCreated` | `opd.queue.*` seeded | Golden malaria only |
| 4 | Emergency | **NOT_IMPLEMENTED** | `/dept/ae/*` placeholders | Triage API reusable | Event types exist | `emergency` module seeded | None |
| 5 | General Medicine | **PLACEHOLDER** | `/doctor/*` all stubs | Copilot, AI APIs exist | — | `clinical` capabilities | None |
| 6 | General Surgery | **NOT_IMPLEMENTED** | — | — | — | `theatre` module seeded | None |
| 7 | Paediatrics | **NOT_IMPLEMENTED** | — | — | — | `immunization` module | None |
| 8 | Obstetrics & Gynaecology | **NOT_IMPLEMENTED** | — | — | — | `maternity` module seeded | None |
| 9 | Antenatal Clinic | **NOT_IMPLEMENTED** | — | — | — | `maternity` module | None |
| 10 | Labour / Delivery | **NOT_IMPLEMENTED** | — | — | — | — | None |
| 11 | Postnatal | **NOT_IMPLEMENTED** | — | — | — | — | None |
| 12 | Inpatient Medical Ward | **PARTIAL** | `/nurse/ward` placeholder | `GET/POST /api/hospital/admin/beds`, `/wards` | `PatientAdmitted` (type only) | `ipd` module seeded | None |
| 13 | Surgical Ward | **NOT_IMPLEMENTED** | — | — | — | — | None |
| 14 | Paediatric Ward | **NOT_IMPLEMENTED** | — | — | — | — | None |
| 15 | Maternity Ward | **NOT_IMPLEMENTED** | — | — | — | — | None |
| 16 | Laboratory | **PROTOTYPE** | `/lab/orders` (simulation); 6 placeholders | `GET /api/lab/worklist`, `POST /api/lab/actions` (simulation) | Full lab event chain in `@synapse/db/lab-workflow` | `lab.*` capabilities seeded | Golden malaria lab steps |
| 17 | Blood Bank | **NOT_IMPLEMENTED** | — | — | — | — | None |
| 18 | Radiology / Imaging | **NOT_IMPLEMENTED** | — | — | `ImagingOrderCreated`, `ImagingReportFinalized` (types) | `radiology` module seeded | None |
| 19 | Pharmacy | **PARTIAL** | `/pharmacy/queue`, `/dispense`, `/inventory`, `/interactions` | `GET /api/pharmacy/inventory`, `POST /api/pharmacy/interactions` | `PrescriptionCreated`, `MedicationDispensed` | Pharmacy roles | Golden malaria pharm step |
| 20 | Theatre / OR | **NOT_IMPLEMENTED** | — | — | — | `theatre` module seeded | None |
| 21 | Billing / Cashier | **PARTIAL** | — | Platform subscription billing strong; `billing_invoices` in types only | `InvoiceCreated`, `PaymentRecorded` (types) | `billing` capabilities | None |
| 22 | Insurance / Claims | **PARTIAL** | — | `insurance_claims`, `insurance_memberships` tables | `ClaimSubmitted`, etc. (types) | `claims` capabilities | Simulation scenario only |
| 23 | Referral Office | **PARTIAL** | `/doctor/referrals` placeholder | `POST /api/facility/referral` | `ReferralCreated`, `ReferralAccepted`, `ReferralCompleted` | — | Simulation scenario |
| 24 | Stores / Procurement | **NOT_IMPLEMENTED** | — | Pharmacy inventory separate from hospital supplies | — | — | None |
| 25 | Health Information / Records | **PARTIAL** | Patient search in portal | Import wizard `/os/[slug]/migrate` | Timeline projection | `registration` module | None |
| 26 | Public Health / Surveillance | **PLACEHOLDER** | `/platform/dhis2` | DHIS2 inserts pending row | — | `public_health` module | None |
| 27 | Hospital Administration | **OPERATIONAL** | `/hospital/admin/*`, `/admin/*` | Full CRUD: departments, beds, wards, staff, modules, services, settings, audit | Audit events | `has_capability` RPC | None |

### Optional / later (honest NOT_IMPLEMENTED)

Physiotherapy, Mental Health, Dental, ENT, Ophthalmology, ICU, NICU, Renal/Dialysis, Oncology — no schema, no routes, no events.

---

## Workflow inventory

### Identity & registration

| Component | Status | Location |
|---|---|---|
| `persons`, `person_identifiers`, `patients` tables | OPERATIONAL | migrations + types |
| `generateSynapseId`, MPI scoring | PARTIAL | `packages/db/src/identity.ts`, `mpi.ts` |
| Hospital register → persons wiring | PARTIAL | Register form writes patients; persons link incomplete |
| Duplicate detection | PARTIAL | `identity_match_candidates`; no auto-merge (`shouldAutoMerge` always false) |
| `PatientRegistered` event | PARTIAL | Event type defined; not consistently emitted from register API |

### Encounter & clinical

| Component | Status | Location |
|---|---|---|
| `encounters`, `vitals`, `encounter_diagnoses` | OPERATIONAL | production schema |
| `POST /api/opd/triage` | OPERATIONAL | canonical encounter create |
| `POST /api/encounters` | **BROKEN** | Returns 410 Gone |
| `/os/[slug]/encounters/new` | **BROKEN** | Calls retired encounters API |
| Doctor workspace | PLACEHOLDER | 10 stub pages |
| Copilot encounter advisory | OPERATIONAL | `GET /api/copilot/encounter` |
| Intelligence differential | OPERATIONAL | `@synapse/interop` kernel + Test Center |
| ICD-11 terminology | OPERATIONAL | WHO MMS probe + search; golden journey verified |
| Clinical pathways | PROTOTYPE | In-memory `PathwayRuntime`; 4 pathways (malaria, sepsis, DKA, pneumonia) |
| Signed documentation immutability | NOT_IMPLEMENTED | No signed-state enforcement |

### Laboratory

| Component | Status | Location |
|---|---|---|
| `lab_orders`, `lab_results`, `lab_specimens` | OPERATIONAL | schema + migration |
| `LabWorkflow` state machine | OPERATIONAL | `packages/db/src/lab-workflow.ts` — 13 states |
| Lab UI | PROTOTYPE | `/lab/orders` uses simulation engine only |
| Verified result overwrite protection | OPERATIONAL | State machine rejects silent overwrite |
| Clinician → lab order handoff | **BROKEN** | No order creation from clinical UI |
| Platform Lab Monitor | PARTIAL | `/platform/lab` — DB probes |

### Pharmacy

| Component | Status | Location |
|---|---|---|
| Hospital dispensing (`clinical_prescriptions`) | PARTIAL | Schema + golden journey |
| Synapse Pharm POS (`apps/pharmacy`) | OPERATIONAL | Full POS, FEFO, inventory |
| `/pharmacy/queue` | PARTIAL | Reads `dispense_requests`; no clinical intake |
| Inventory decrement on dispense | PARTIAL | POS authoritative; hospital dispense bypasses queue |
| Prescription → pharmacy task routing | **BROKEN** | No WorkQueue connection |

### Inpatient

| Component | Status | Location |
|---|---|---|
| `hospital_beds`, wards admin | PARTIAL | Admin APIs exist; no admission workflow |
| Admission/transfer/discharge events | PARTIAL | Event types defined; no runtime |
| Nursing workspace | PLACEHOLDER | 7 stub pages |
| MAR (medication administration) | NOT_IMPLEMENTED | — |

### Imaging

| Component | Status | Location |
|---|---|---|
| Imaging workflow | NOT_IMPLEMENTED | Event types only |
| PACS/DICOM | NOT_IMPLEMENTED | — |
| Simulation adapter | NOT_IMPLEMENTED | Planned in milestone |

### Billing & insurance

| Component | Status | Location |
|---|---|---|
| Platform SaaS billing | OPERATIONAL | Flutterwave, subscriptions |
| Clinical billing (`billing_invoices`) | PARTIAL | Types only; no charge-from-clinical flow |
| Insurance claims | PARTIAL | Schema + simulation scenario |
| Clinical → charge → invoice → payment | **BROKEN** | No interconnectivity |

### Interconnectivity

| Component | Status | Location |
|---|---|---|
| Synapse Exchange outbox | OPERATIONAL | `synapse_domain_events`, `ExchangeOutbox` |
| 37 domain event types | OPERATIONAL | `packages/interop/src/events.ts` |
| Correlation/causation IDs | OPERATIONAL | Envelope spec |
| Task/WorkQueue abstraction | **NOT_IMPLEMENTED** | `consult_queue` partial; no unified engine |
| Patient Timeline projection | PARTIAL | `packages/db/src/timeline.ts`; 16 event types |
| FHIR HTTP resources | PARTIAL | Mappings in golden journey; handlers mixed 501/implemented |
| External system adapters | PROTOTYPE | Simulation adapters (eAFYA, UgandaEMR, ALIS, DHIS2) |

---

## Existing tables by domain

| Domain | Tables | Migration coverage |
|---|---|---|
| Tenants/Facilities | `tenants`, `organizations`, `hospitals`, `hospital_settings`, `hospital_modules` | Strong |
| Departments | `departments` | Baseline |
| Locations | **None** — ward as string on `hospital_beds` | Gap |
| Staff | `profiles`, `staff_scope_assignments`, `staff_invitations` | Strong |
| Patients/Identity | `persons`, `patients`, `person_identifiers`, `person_relationships` | Strong |
| Encounters | `encounters`, `vitals`, `encounter_diagnoses`, `clinical_notes` | Baseline |
| Lab | `lab_orders`, `lab_results`, `lab_specimens`, `lab_result_amendments` | Strong |
| Pharmacy | `clinical_prescriptions`, `pharmacy_orders`, `drug_inventory` + POS tables | Split |
| Billing | `billing_invoices`, `billing_line_items` | Types only |
| Insurance | `insurance_claims`, `insurance_memberships`, `insurance_providers` | Baseline |
| Referrals | `facility_referrals` | Baseline |
| Tasks | `consult_queue`, `housekeeping_tasks`, `handover_shift_tasks` | Fragmented |
| Events | `synapse_domain_events`, `audit_events`, `patient_timeline_events` | Strong (events); partial (timeline) |
| Pathways | `patient_pathways`, `clinical_pathway_templates`, `pathway_overrides` | Types + in-memory runtime |
| Inpatient | `hospital_beds` | Types only |

---

## Existing APIs by department

| Department | Operational APIs | Missing APIs |
|---|---|---|
| Reception | `POST /api/patients/register`, `GET /api/patients/search` | Duplicate check UI, emergency registration |
| Triage/OPD | `POST /api/opd/triage`, `GET /api/opd/queue` | Triage UI, queue management |
| Clinical | `POST /api/ai/diagnose`, `GET /api/copilot/encounter`, `POST /api/intelligence/differential` | Encounter workspace, orders, prescriptions |
| Lab | `GET /api/lab/worklist`, `POST /api/lab/actions` (simulation) | Production DB-backed worklist |
| Pharmacy | `GET /api/pharmacy/inventory`, `POST /api/pharmacy/interactions` | Prescription intake from clinical |
| Hospital Admin | Full CRUD under `/api/hospital/admin/*` | Location management |
| Platform | Test Center, Simulation Lab, golden journeys | Hospital acceptance runner |

---

## RBAC baseline

| Layer | Implementation | Status |
|---|---|---|
| Profile role | `profiles.role` CHECK constraint | OPERATIONAL |
| Capability lattice | `capabilities`, `role_capabilities`, `has_capability()` RPC | OPERATIONAL (~50+ hospital capabilities) |
| Scoped assignments | `staff_scope_assignments` (org/tenant/site/department) | OPERATIONAL |
| Pharmacy permissions | `pharmacy_staff_permissions`, `pharmacy_user_settings.pharmacy_role` | OPERATIONAL |
| Subscription gates | `has_feature(tenant_id, feature_key)` | OPERATIONAL |
| RLS tenant isolation | `current_tenant_id()`, policies on clinical tables | OPERATIONAL |
| Platform admin clinical bypass | Hardcoded in `capability.ts` | **UNSAFE** if extended to clinical notes |
| Negative permission tests | — | NOT_IMPLEMENTED |

---

## Test infrastructure

| Component | Status | Location |
|---|---|---|
| Universal Test Center | OPERATIONAL | `/platform/test-center` |
| Malaria Golden Journey | OPERATIONAL | `@synapse/db/malaria-golden-journey` — 15 steps |
| Simulation Engine | OPERATIONAL | `@synapse/db/simulation` — 8 scenarios |
| Demo reset guard | OPERATIONAL | `assertDemoResetAllowed()` |
| Hospital acceptance runner | NOT_IMPLEMENTED | This milestone |
| Department matrix in Test Center | NOT_IMPLEMENTED | This milestone |
| Staff role session tests | NOT_IMPLEMENTED | This milestone |

---

## Documentation drift (Phase 48 preview)

| Doc | Claim | Code truth |
|---|---|---|
| `SYNAPSE_EXCHANGE_SPEC.md` | FHIR HTTP 501 | Golden journey produces FHIR Patient/Observation/Condition |
| `WEEKEND_PLATFORM_AUDIT_2026.md` | Pathways no runtime | `PathwayRuntime` in-memory with 4 pathways |
| `WEEKEND_PLATFORM_AUDIT_2026.md` | All `/lab/*` Coming soon | `/lab/orders` has simulation prototype |
| `hospital-module-map.md` | Phase 2 screens exist | Most are literal placeholder stubs |

---

## Milestone starting point

**What works end-to-end (synthetic):**
Malaria OPD golden journey via Test Center: Registration → Encounter → Intelligence → ICD-11 → Pathway → Lab → Timeline → Prescription → Pharm → FHIR — one correlation ID, step-level PASS/FAIL.

**What this milestone must build:**
1. Deterministic synthetic hospital tenant (`synapse-integrated-demo`, seed `20260830`)
2. 27 departments, locations, staff, RBAC assignments
3. Interdepartment Task/WorkQueue engine
4. 10 golden hospital journeys + COMPLETE_HOSPITAL_DAY
5. Test Center Hospital Acceptance department matrix
6. Fix P0/P1 gaps: encounter API wiring, task routing, admission chain
7. Truthful acceptance reports

**Canonical hospital shell:** `/os/[slug]` — role-adaptive navigation within one patient/encounter/timeline model.
