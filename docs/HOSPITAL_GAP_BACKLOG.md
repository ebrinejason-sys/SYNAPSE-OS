# Hospital Gap Backlog — 2026-08-30

Ranked issues discovered during hospital acceptance audit and initial testing.

## P0 — Safety

| ID | Department | Workflow | Current | Expected | Root cause | Fix | Complexity |
|---|---|---|---|---|---|---|---|
| P0-001 | Pharmacy | Dispense | Manual insert as dispensed, skips verification | Verify → dispense → inventory decrement | **PARTIAL** — /api/hospital/pharmacy/dispense + updated UI | Route through WorkQueue + authoritative inventory RPC | M |
| P0-002 | Clinical | Signed notes | No immutability | Signed docs cannot silently change | No signed-state on encounters/notes | Add signed_at + amendment trail | M |
| P0-003 | Security | Platform admin | Role bypass in capability.ts | No automatic clinical superuser | Hardcoded bypass | Scope bypass to platform ops only | S |

## P0 — Security

| ID | Department | Workflow | Current | Expected | Root cause | Fix | Complexity |
|---|---|---|---|---|---|---|---|
| P0-004 | All | Tenant isolation | RLS exists | Fail closed on cross-tenant | Needs live test | Add cross-tenant access tests | S |
| P0-005 | Synthetic | Reset guard | In-memory guard | Production reset impossible | DB-level guard needed | Add DB trigger/check on hospital_seed_registry | S |

## P1 — Broken core workflow

| ID | Department | Workflow | Current | Expected | Root cause | Files | Fix | Complexity |
|---|---|---|---|---|---|---|---|
| P1-001 | OPD | Encounter save | Was 410 API | Triage creates encounter | Retired endpoint | encounters/new/page.tsx | **FIXED** — uses /api/opd/triage | S |
| P1-002 | OPD | Doctor orders | No lab orders from UI | Lab task in WorkQueue | **FIXED** — /api/opd/lab-orders + encounter UI | work-queue.ts | Wire routeClinicalOrder in encounter API | M |
| P1-003 | OPD | Prescription | No pharmacy queue | Pharmacy task created | **FIXED** — /api/opd/prescriptions | work-queue.ts | Wire prescription → department_tasks | M |
| P1-004 | Lab | Worklist UI | Simulation only | Production DB worklist | **FIXED** — /api/lab/worklist DB branch | lab/orders page | Connect to lab_orders + WorkQueue | L |
| P1-005 | Inpatient | Admission | Admin beds only | Admit → assign bed → encounter | No admission service | — | Build admission workflow + events | L |

## P1 — Interconnectivity

| ID | Department | Workflow | Current | Expected | Root cause | Fix | Complexity |
|---|---|---|---|---|---|---|---|
| P1-006 | All | Task routing | Fragmented queues | Unified WorkQueue | No abstraction existed | **CREATED** work-queue.ts — needs wiring | M |
| P1-007 | Clinical | Timeline | Projection helpers | Full journey in one timeline | Partial publishers | Extend timeline publishers for all handoffs | M |
| P1-008 | Billing | Clinical→charge | No bridge | Service event → invoice | billing_invoices unused | Clinical activity charge service | L |

## P1 — Clinical usability

| ID | Department | Workflow | Current | Expected | Fix | Complexity |
|---|---|---|---|---|---|
| P1-009 | OPD | Doctor workspace | 10 placeholder pages | Functional queue + encounter | Build /os/[slug]/clinical or fix /doctor/queue | L |
| P1-010 | Nursing | Ward list | Placeholder | Observations + tasks | Build nurse workspace in /os/[slug] | L |
| P1-011 | Emergency | ED flow | NOT_IMPLEMENTED | Rapid reg → triage → resus | Build ED vertical slice | XL |

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
| P0-001 | Dispense decrements inventory via complete_pharmacy_sale or hospital equivalent |
