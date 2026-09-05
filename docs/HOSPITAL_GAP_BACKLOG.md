# Hospital Gap Backlog — 2026-08-30

## P0-004 / P0-RBAC evidence update (2026-09-05)

Isolation and negative capability coverage now runs as follows:

- Offline on every run: `npm run test --workspace @synapse/web` includes the pure tenant-scope and invite-binding predicates.
- The same offline web run includes the static negative RBAC mirror; the DB-backed assertions remain authoritative when Supabase is available.
- With `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`: `npm run test --workspace @synapse/pharmacy` runs the P0-004 tenant fixture and `P0-RBAC` SQL `has_capability` assertions. Without those variables, Vitest skips these integration files with an explicit message.
- P0-004 DB coverage creates two synthetic tenants, a tenant-A staff profile and scope, then proves tenant-B filtering cannot return tenant-A patients/encounters and the staff scope contains no tenant-B binding. The OS authorization predicate separately proves tenant-B entry is denied.
- P0-RBAC coverage proves receptionist cannot verify lab results, lab technician cannot create prescriptions, cashier/billing officer cannot amend diagnosis, pharmacist cannot amend physician diagnosis, and platform admin cannot receive automatic hospital clinical-note capability. The corrective migration also removes the pre-existing lab-technician verifier grant.

Remaining matrix rows still not implemented or not proven by this slice: emergency nurse, emergency doctor, surgeon, public health officer, landing-page assertions, clinician/POS stock separation, and full route-level end-to-end requests for every role. DNS/Vercel wildcard and pharmacy domain attachment remain operator-owned blockers.

## P0-001 dispense evidence (2026-09-05)

**Status: FIXED for the hospital clinical dispense path.** `/os/<facility-slug>/clinical/dispense` loads tenant-scoped pharmacy tasks from `/api/hospital/tasks?department=pharmacy`, selects the linked prescription, and posts to `/api/hospital/pharmacy/dispense`. The server requires dispensing capability and, for active prescriptions, verification capability; it then uses `complete_pharmacy_sale`, updates the prescription and department task, persists domain events, and publishes the medication timeline event. The sale idempotency key is `clinical_prescriptions:<prescription_id>`.

Operator runbook:

1. Sign in as a pharmacist assigned to the facility and open `/os/<facility-slug>/clinical/dispense`.
2. Select an open pharmacy task. Confirm the linked prescription, product, and pharmacy tenant, then submit the dispense.
3. The prescription is verified when required, stock is decremented through the pharmacy inventory authority, the task becomes `COMPLETED`, and the medication dispense event is recorded.
4. A retry of the same prescription is rejected as already dispensed and cannot decrement stock again. Receptionist, lab technician, and cashier roles receive a capability denial.

Evidence: `P0-001` bridge tests cover verification, insufficient stock, duplicate dispense safety, and unauthorized roles; `hospital-dispense-idempotency.integration.test.ts` covers the real `complete_pharmacy_sale` path, exactly-once stock decrement, and pharmacy task completion when `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are present. Without those variables the DB test skips cleanly.

Ranked issues discovered during hospital acceptance audit and initial testing.

## P0 — Safety

| ID | Department | Workflow | Current | Expected | Root cause | Fix | Complexity |
|---|---|---|---|---|---|---|---|
| P0-001 | Pharmacy | Dispense | Manual insert as dispensed, skips verification | Verify → dispense → inventory decrement | **FIXED** — hospital clinical shell task path, capability gates, authoritative sale RPC, task completion, timeline event, and idempotency coverage | Keep route-level E2E coverage as future hardening | M |
| P0-002 | Clinical | Signed notes | No immutability | Signed docs cannot silently change | **FIXED** — amendment RPC + trail + trigger guard | Add signed_at + amendment trail | M |
| P0-003 | Security | Platform admin | Role bypass in capability.ts | No automatic clinical superuser | **FIXED** — hospital facilityType enforced | Scope bypass to platform ops only | S |

## P0 — Security

| ID | Department | Workflow | Current | Expected | Root cause | Fix | Complexity |
|---|---|---|---|---|---|---|---|
| P0-004 | All | Tenant isolation | RLS exists | Fail closed on cross-tenant | **PARTIAL** — isolation tests fail CI if Supabase secrets missing; integration runs when configured | Expand coverage to tasks/billing tables | S |
| P0-005 | Synthetic | Reset guard | In-memory guard | Production reset impossible | **FIXED** — DB trigger on hospital_seed_registry | Add DB trigger/check on hospital_seed_registry | S |

## P1 — Broken core workflow

| ID | Department | Workflow | Current | Expected | Root cause | Files | Fix | Complexity |
|---|---|---|---|---|---|---|---|
| P1-001 | OPD | Encounter save | Was 410 API | Triage creates encounter | Retired endpoint | encounters/new/page.tsx | **FIXED** — uses /api/opd/triage | S |
| P1-002 | OPD | Doctor orders | No lab orders from UI | Lab task in WorkQueue | **FIXED** — /api/opd/lab-orders + encounter UI | work-queue.ts | Wire routeClinicalOrder in encounter API | M |
| P1-003 | OPD | Prescription | No pharmacy queue | Pharmacy task created | **FIXED** — /api/opd/prescriptions | work-queue.ts | Wire prescription → department_tasks | M |
| P1-004 | Lab | Worklist UI | Simulation only | Production DB worklist | **FIXED** — /api/lab/worklist DB branch | lab/orders page | Connect to lab_orders + WorkQueue | L |
| P1-005 | Inpatient | Admission | Admin beds only | Admit → assign bed → encounter | **FIXED** — /api/ipd/admissions | — | Build admission workflow + events | L |

## P1 — Interconnectivity

| ID | Department | Workflow | Current | Expected | Root cause | Fix | Complexity |
|---|---|---|---|---|---|---|---|
| P1-006 | All | Task routing | Fragmented queues | Unified WorkQueue | **FIXED** — /api/hospital/tasks | Extend timeline publishers for all handoffs | M |
| P1-007 | Clinical | Timeline | Projection helpers | Full journey in one timeline | **PARTIAL** — encounter timeline API + doctor orders UI | Extend timeline publishers for all handoffs | M |
| P1-008 | Billing | Clinical→charge | No bridge | Service event → invoice | **PARTIAL** — charge bridge + payment collection API/UI | Partial payments + insurance linkage | L |

## P1 — Clinical usability

| ID | Department | Workflow | Current | Expected | Fix | Complexity |
|---|---|---|---|---|---|
| P1-009 | OPD | Doctor workspace | 10 placeholder pages | Functional queue + encounter | **FIXED for core OPD shift** — `/os/[slug]/clinical/queue` lists tenant-scoped encounters, opens orders/timeline, places lab/Rx orders, and signs encounters behind capability gates | Extend specialty workspaces outside scope | L |
| P1-010 | Nursing | Ward list | Placeholder | Observations + tasks | **FIXED for core ward shift** — `/os/[slug]/clinical/nursing` provides scoped ward patients, vitals recording, nursing task transitions, and timeline handoff | Extend specialty nursing workflows outside scope | L |
| P1-011 | Emergency | ED flow | NOT_IMPLEMENTED | Rapid reg → triage → resus | **PARTIAL** — /emergency/triage + APIs | Build ED vertical slice | XL |

## P2 — Operational

| ID | Department | Issue | Fix | Complexity |
|---|---|---|---|---|
| P2-001 | Imaging | No workflow | Simulation adapter (honest, no PACS) | L |
| P2-002 | Locations | No facility_locations usage | Seed locations to DB on hospital create | M |
| P2-003 | Staff | No runtime auth for synthetic accounts | Safe test-account provisioning API | M |
| P2-004 | Public Health | DHIS2 placeholder | Block synthetic from real reporting (done in seed flags) | S |

## P3 — Enhancement

| ID | Department | Issue |
|---|---|---|
| P3-001 | All optional specialties | Physiotherapy, Mental Health, Dental, ENT, ICU, etc. |
| P3-002 | Blood bank | Full ABO/Rh/crossmatch workflow |
| P3-003 | Offline | Classify operations OFFLINE_SAFE vs ONLINE_REQUIRED |

## Closure tests

| Gap ID | Test that proves closure |
|---|---|
| P1-001 | POST /api/opd/triage from /os/[slug]/encounters/new returns 201 |
| P1-002 | Doctor order creates department_tasks row with owner_department=laboratory |
| P1-003 | Prescription creates department_tasks with owner_department=pharmacy |
| P1-004 | /lab/orders shows orders from lab_orders table for tenant |
| P1-005 | Admission emits PatientAdmitted + assigns hospital_beds.current_patient_id |
| P1-006 | WorkQueue.list returns tasks filtered by department |
| P0-001 | Dispense decrements inventory via complete_pharmacy_sale or hospital equivalent; idempotent retry does not double-decrement |
| P0-004 | CI fails when SUPABASE_* missing; cross-tenant encounter/patient queries return null |
| P1-008 | Charge creates draft invoice; POST pay updates paid_amount; idempotent payment key |
| P1-009 | `/os/[slug]/clinical/queue` → orders/timeline → sign; `clinical-workspace.test.ts` and existing OPD API guards |
| P1-010 | `/os/[slug]/clinical/nursing` → `/api/nurse/vitals` and nursing task POST; `clinical-workspace.test.ts`; DB-backed route checks remain credential-gated |

## Clinical workspace operator steps

1. A doctor opens `/os/<facility-slug>/clinical/queue`, selects an encounter, opens **Orders & timeline**, places lab orders or prescriptions, reviews the timeline, and signs the encounter.
2. A nurse opens `/os/<facility-slug>/clinical/nursing`, selects an in-scope ward patient or nursing task, records vitals, then accepts, starts, and completes the task as appropriate.
3. Wrong-tenant staff, unsigned capability roles, or mismatched patient/encounter IDs receive a denied response; specialty ED/ICU coverage remains outside this slice.
