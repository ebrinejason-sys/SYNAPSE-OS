# ALIS Parity Matrix

Date: 2026-09-09
Baseline: `c1d9a65f859ec762a15bba28905d6b3dcc18aa0e`

This matrix uses the official ALIS operational areas supplied in the mission as the floor. Status values are `SYNAPSE_HAS`, `SYNAPSE_PARTIAL`, `SYNAPSE_MISSING`, `SYNAPSE_BETTER`, and `NOT_YET_REQUIRED`.

| ALIS capability | Status | Current evidence | Required proof or gap |
|---|---|---|---|
| Lab users, roles, permissions | SYNAPSE_HAS | Shared platform auth/RBAC and Lab access checks exist | Run positive and negative role tests for technician, verifier, and facility boundary. |
| Lab sections and configuration | SYNAPSE_PARTIAL | Facility Lab profile and sections are provisioned | Catalogue section/test/component configuration needs acceptance coverage. |
| Patient registration and search | SYNAPSE_PARTIAL | External referral registration and hospital patient flows exist | Prove duplicate handling, identity crosswalk, and Lab-only patient journey. |
| Test catalogue, measures, units, panels | SYNAPSE_PARTIAL | LOINC-backed order/result fields exist | Audit durable catalogue, components, units, reference ranges, and facility configuration. |
| TAT targets | SYNAPSE_MISSING | Lab report/result surfaces exist | Add or classify TAT target and measured TAT evidence. |
| Test requests and clinical details | SYNAPSE_HAS | Hospital Lab orders and external referral endpoint exist | Prove clinical context, referrer, location, therapy, and order persistence. |
| Accession and barcode | SYNAPSE_PARTIAL | Accession numbers are displayed and matched in staging | Barcode generation/label workflow needs executable proof. |
| Collection, receipt, accept/reject | SYNAPSE_PARTIAL | Worklist actions include collect and receive | Rejection reason, recollection, container, actor, and timestamps need proof. |
| Patient Lab history | SYNAPSE_PARTIAL | Patient Lab route and result/report surfaces exist | Prove history across hospital and standalone Lab contexts. |
| Section worklists and statuses | SYNAPSE_HAS | Worklist and action APIs expose durable state transitions | Prove filtering by section, priority, instrument, and all required states. |
| Manual numeric/text/qualitative results | SYNAPSE_HAS | Result entry and typed result fields exist | Expand acceptance tests for coded, boolean, ordinal, ratio, and titer values. |
| Result verification and approval | SYNAPSE_HAS | `/lab/verify` separates verification and release | Prove unauthorized verification, return/correction, amendment, and audit. |
| Immutable released report versions | SYNAPSE_PARTIAL | Lab report release/version primitives exist | Prove released rows are immutable and amendments retain prior versions. |
| Patient report | SYNAPSE_PARTIAL | Report route/API exists | Validate printable report fields, verifier, timestamps, flags, method, and comments. |
| Daily logs, counts, pending, rejected, TAT | SYNAPSE_PARTIAL | Platform Lab monitor and Lab result surfaces exist | Add durable aggregate evidence and acceptance assertions. |
| Surveillance / HMIS 105 | NOT_YET_REQUIRED | Public health and DHIS2 surfaces exist | Keep explicit backlog unless required for pilot facility. |
| Biosafety / biosecurity incidents | SYNAPSE_MISSING | Platform incidents exist but Lab-specific quality flow is unproven | Audit and scope a quality module; do not imply ALIS parity. |
| Equipment maintenance and breakdown | SYNAPSE_PARTIAL | Lab instruments route and Edge heartbeat exist | Add service schedule, calibration, breakdown, restoration, vendor, and document proof. |
| Reagent / commodity inventory | SYNAPSE_MISSING | Pharmacy inventory is separate and mature | Model Lab commodity semantics separately before claiming parity. |
| Analyzer ingestion | SYNAPSE_PARTIAL | ASTM/HL7/file adapters, raw persistence, staging, and analyzer tests exist | Prove real or simulator end-to-end ingest, unknown accession/test safety, and idempotent replay. |
| Offline Edge durability | SYNAPSE_HAS | SQLite queue/retry/restart tests exist | Connect Edge evidence to a cloud Lab golden run. |
| FHIR Patient/Observation/DiagnosticReport | SYNAPSE_PARTIAL | FHIR serving code exists | Prove released-result output and tenant authorization. |

## Synapse Differentiators to Preserve

- Universal Synapse ID and identity crosswalk.
- Hospital-native Lab orders and standalone Lab referrals.
- Lab Edge raw-message durability and human release boundary.
- FHIR R4 resources and Exchange/event architecture.
- Cross-facility operational monitoring without granting Platform Admin arbitrary PHI access.

## Pilot Blockers

The minimum ALIS-facing blockers are TAT evidence, specimen rejection/recollection proof, professional printable reporting, equipment lifecycle evidence, and an explicit decision on Lab commodity inventory. These should be resolved or clearly excluded from the controlled pilot scope.

## CONTROL PLANE BASELINE

The facility provisioning contract now proves standalone laboratory creation, preserved tenant linkage, pending domain evidence, reserved slug rejection, required-step fail-closed behavior, and retry idempotency. Lab Edge remains 12/12 green. These results support the Lab control plane but do not promote the ALIS capability rows to GREEN.
