# SYNAPSE Lab Cloud Release Audit

Audit date: 2026-09-08

| Capability | Status | Evidence / gap |
| --- | --- | --- |
| Verification | READY | `LabWorkflow.verify` requires a human verifier and the web staging accept route gates lab roles. |
| Release | PARTIAL | `executeHospitalLabAction` persists released `lab_results` and publishes a timeline event; report creation was not coordinated. |
| Report artifact | MISSING | No durable `lab_reports` model or report-generation service existed before this milestone. |
| PDF / print | PARTIAL | Printable HTML is the safe server-side artifact contract; binary PDF conversion requires a configured renderer. |
| FHIR Observation | PARTIAL | R4 mapper exists, but the FHIR read route did not load released Lab results. |
| FHIR DiagnosticReport | PARTIAL | R4 mapper exists, but no tenant-authorized Lab report read path existed. |
| Exchange | PARTIAL | Exchange outbox exists for other workflows; Lab release persistence did not create a durable report event. |
| Timeline | READY | `LabResultReleased` timeline publication exists in the hospital Lab action path. |
| Patient delivery | MISSING | No Lab report delivery state or patient report endpoint exists. |
| External referrer delivery | MISSING | No authorized external referrer delivery contract exists. |

This audit intentionally does not claim a live database/API golden pass. That requires an explicitly enabled synthetic tenant and deployed migration state.