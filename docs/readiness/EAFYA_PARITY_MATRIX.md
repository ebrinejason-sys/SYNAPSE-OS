# eAFYA Operational Parity Matrix

Date: 2026-09-09
Baseline: `c1d9a65f859ec762a15bba28905d6b3dcc18aa0e`

This is an audit baseline, not a claim that route names equal completed capability. Status values are `SYNAPSE_HAS`, `SYNAPSE_PARTIAL`, `SYNAPSE_MISSING`, and `SYNAPSE_BETTER`.

| Capability | Status | Current evidence | Required proof or gap |
|---|---|---|---|
| Patient search before registration | SYNAPSE_PARTIAL | Patient list and registration surfaces exist | Prove duplicate prevention and search-before-create journey. |
| Universal identity / Synapse ID | SYNAPSE_HAS | Patient and referral models expose Synapse identity fields | Prove cross-facility crosswalk without silent merges. |
| Registration demographics and contacts | SYNAPSE_PARTIAL | Registration form and patient APIs exist | Audit field coverage against policy and consent requirements. |
| Appointments and walk-in visits | SYNAPSE_PARTIAL | Visit/encounter routes exist | Prove durable arrival, queue, no-show, cancellation, and completion states. |
| Queue and priority | SYNAPSE_HAS | Clinical queue and work queue surfaces exist | Prove handoff and reload persistence. |
| Triage vitals | SYNAPSE_PARTIAL | Triage persists temperature, pulse, BP, and SpO2 | Add or verify RR, weight, height/BMI, pain, glucose, GCS/AVPU, danger signs, category, notes. |
| Comprehensive history / HPI | SYNAPSE_PARTIAL | Encounter history route exists | Field-level HPI, chronology, associated symptoms, negatives, prior care, red flags need durable storage and sign/version proof. |
| Past medical, surgical, drug, allergy, family, social history | SYNAPSE_PARTIAL | Patient/encounter surfaces exist | Audit each section, reaction/severity, consent, author, and timestamps. |
| Review of systems | SYNAPSE_MISSING | No verified complete section in current encounter flow | Implement or explicitly defer outside pilot with truthful route behavior. |
| Physical examination | SYNAPSE_PARTIAL | Clinical pages and specialty routes exist | Prove general and system examination persistence in clinician workspace. |
| Assessment and ICD-11 | SYNAPSE_PARTIAL | AI differential and ICD-11 platform surfaces exist | Human-authored problem list, certainty, reasoning, and coding must be signed and versioned. |
| Orders and results review | SYNAPSE_HAS | Order APIs, Lab worklist, and result review route exist | Prove returned result is visible in the source encounter after reload. |
| Prescribing and pharmacy handoff | SYNAPSE_HAS | Prescription and hospital dispense APIs exist | Prove Pharm queue, FEFO decrement, event, billing, and idempotent retry. |
| Inpatient / ward | SYNAPSE_PARTIAL | Ward, beds, nursing, MAR, handover pages exist | Prove admission, bed assignment, transfer, rounds, care tasks, and discharge transitions. |
| Theatre / surgery | SYNAPSE_PARTIAL | Theatre schedule and checklist routes exist | Audit procedure request, consent, operative note, consumables, destination, complications, and billing. |
| ICU / critical care | SYNAPSE_PARTIAL | ICU dashboard, flowsheet, and scoring routes exist | Audit persistence and classify as pilot scope or backlog. |
| Immunization | SYNAPSE_PARTIAL | Immunisation routes exist | Verify vaccine, dose, batch, site, route, actor, next dose, and adverse event persistence. |
| Referrals | SYNAPSE_MISSING | Active referral pages are explicit stubs | Replace dead ends or remove from critical production navigation. |
| Longitudinal timeline | SYNAPSE_HAS | Timeline APIs/projection code exists | Prove timeline is a projection and reflects clinical closure, Lab, Pharm, billing, and disposition. |
| Billing / cashier | SYNAPSE_PARTIAL | Encounter billing/payment routes exist | Prove actual-service charges, waivers, subsidy, insurance, and non-revenue journeys. |
| Offline durability | SYNAPSE_PARTIAL | Lab Edge has durable queue | Clinical offline mode, outbox, conflicts, and replay are not proven by this audit. |

## Highest-Priority Parity Work

1. Complete the clinician write-up as a structured, narrative-capable, signed and versioned workspace.
2. Prove inpatient lifecycle and discharge propagation across bed, encounter, billing, queue, and timeline.
3. Replace or honestly disable active referral stubs.
4. Run one synthetic hospital journey across registration, triage, clinical documentation, Lab, Pharm, billing, and disposition.

## CONTROL PLANE BASELINE

Provisioning evidence now includes deterministic synthetic facility slugs, reserved-host rejection, pending domain records, fail-closed required steps, pharmacy adapter-specific retry, and idempotent replay without duplicate resources. These changes establish control-plane infrastructure only; they do not change the clinical parity classifications above.
