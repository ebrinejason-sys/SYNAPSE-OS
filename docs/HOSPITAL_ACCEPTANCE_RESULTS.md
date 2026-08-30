# Hospital Acceptance Results — 2026-08-30

**Base commit:** `75b6958` + hospital acceptance milestone work  
**Hospital:** SYNAPSE INTEGRATED REGIONAL HOSPITAL (`synapse-integrated-demo`)

## What works

| Area | Evidence |
|---|---|
| Synthetic hospital seeding | `seedHospital()` — 27 departments, 28 locations, 33 staff, 10 test patients, deterministic seed 20260830 |
| Idempotent seed | Running seed twice returns same snapshot (no duplication) |
| Demo reset guard | `assertDemoResetAllowed()` blocks production reset |
| Malaria OPD golden journey | 15 steps PASS via Test Center |
| Lab state machine | 13 states, verified result overwrite protection |
| Exchange events | Correlation chains in golden journey |
| ICD-11 terminology | Verified stem selection in golden journey |
| Intelligence advisory | Differential with invented ICD stripped |
| Pathway runtime | Malaria, sepsis, DKA, pneumonia in-memory |
| Hospital admin CRUD | Departments, beds, wards, staff, modules, services |
| OPD triage API | Canonical encounter create path |
| Test Center hospital matrix | Department acceptance table with honest statuses |

## What partially works

| Area | Gap |
|---|---|
| Tenant portal `/os/[slug]` | Patients, import, dashboard; encounter save now wired to triage |
| Laboratory | Architecture + golden journey; UI uses simulation only |
| Pharmacy | Queue/inventory/interactions; no clinical intake |
| Registration | API exists; persons link incomplete |
| RBAC | Capability lattice seeded; no negative permission tests |
| Simulation scenarios | 8 scenarios (malaria, sepsis, DKA, pneumonia, insurance, referral) |
| Inpatient beds | Admin APIs; no admission workflow |

## What fails

| Area | Issue |
|---|---|
| `/os/[slug]/encounters/new` | Was calling 410 API — **fixed** this milestone |
| Doctor → Lab handoff | No order creation from clinical UI |
| Doctor → Pharmacy handoff | No prescription routing |
| Clinical → Billing | No charge generation |

## What is NOT implemented

Emergency, Surgery, Paediatrics, Maternity (all wards), Blood Bank, Imaging, Theatre, Stores, Public Health, and 14 of 27 departments.

Golden journeys not yet runnable: SURGERY_APPENDICITIS, MATERNITY_PREECLAMPSIA, PAEDIATRIC_MALARIA, COMPLETE_HOSPITAL_DAY.

## What is unsafe

- Platform admin clinical bypass in `capability.ts` (must not extend to clinical notes)
- Hospital dispense bypassing pharmacy queue (direct `dispensed` insert)
- No signed documentation immutability enforcement

## What was fixed this milestone

1. `/os/[slug]/encounters/new` → `POST /api/opd/triage` (was 410)
2. WorkQueue / department_tasks abstraction created
3. Hospital seed framework with create/reset/reseed/inspect
4. Test Center Hospital Acceptance department matrix
5. facility_locations + hospital_seed_registry migrations
6. Baseline audit and required documentation

## What remains

See `docs/HOSPITAL_GAP_BACKLOG.md`

## Final matrix

| Department | Primary role | Core workflow | Standalone | Interdept | Security | Result | Evidence |
|---|---|---|---|---|---|---|---|
| Reception | Receptionist | Register patient | PARTIAL | PARTIAL | NOT_RUN | PARTIAL | patients API |
| Triage | Triage Nurse | Triage + vitals | PARTIAL | PARTIAL | NOT_RUN | PARTIAL | opd/triage API |
| OPD | OPD Doctor | Consult + orders | PARTIAL | FAIL | NOT_RUN | PARTIAL | golden malaria |
| Laboratory | Lab Scientist | Order→result | PARTIAL | PARTIAL | NOT_RUN | PARTIAL | golden lab steps |
| Pharmacy | Pharmacist | Verify + dispense | PARTIAL | PARTIAL | NOT_RUN | PARTIAL | golden pharm step |
| Administration | Hospital Admin | Config + staff | PASS | N/A | NOT_RUN | PARTIAL | admin APIs |
| Emergency | ED Doctor | Resus + STAT | NOT_IMPL | NOT_IMPL | NOT_RUN | NOT_IMPL | — |
| Imaging | Radiologist | Order→report | NOT_IMPL | NOT_IMPL | NOT_RUN | NOT_IMPL | — |
| Inpatient | Ward Nurse | Admit→discharge | NOT_IMPL | NOT_IMPL | NOT_RUN | NOT_IMPL | — |
