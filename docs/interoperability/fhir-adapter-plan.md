# FHIR adapter plan

Owner: **FHIR / Interoperability agent**. Core owns canonical types.

Status: **PLANNED**. Current HTTP handlers are honest 501 stubs. CapabilityStatement metadata must not be treated as a live server.

No WHO endorsement is claimed. SMART-guideline *compatibility* is a later target.

## Current surfaces (`apps/web/src/app/fhir`)

| Path | Behavior |
|---|---|
| `metadata/route.ts` | Static R4 CapabilityStatement listing 8 resources |
| `Patient/[id]`, `Observation`, `Condition`, `MedicationRequest`, `DiagnosticReport`, `Immunization`, `Encounter`, `AllergyIntolerance` | Re-export `_lib/not-ready.ts` → **501** OperationOutcome |

Those stubs stay 501 until a validated profile-driven implementation exists. Do not return fake Patient JSON.

## Map FHIR → SYNAPSE canonical (`@synapse/interop`)

| FHIR R4 | Canonical (`clinical-contracts` / `canonical.ts`) | SYNAPSE persistence |
|---|---|---|
| Patient / Person | `Person` / `CanonicalPerson` | `persons` + `person_identifiers` |
| Encounter | `Encounter` | Not operational yet — do not map onto random `encounters` rows without Core |
| Observation | `ClinicalObservation` | Provenance required |
| Condition | `Condition` | ICD-11 preferred `codeSystem` |
| MedicationRequest | `MedicationRequest` | Prescription; Pharm fulfils as `MedicationDispense` |
| MedicationDispense | `MedicationDispense` | Pharmacy sale / dispense |
| ServiceRequest | `ServiceRequest` | Lab/imaging/procedure |
| DiagnosticReport | `DiagnosticResult` | Report + observations |
| Specimen | `CanonicalSpecimen` | `lab_specimens` (accession) |
| AllergyIntolerance | keep on canonical union | Person clinical facts (`allergy`) |
| Immunization | (add to canonical when implementing) | Timeline `vaccination` |
| Organization / Location | Organization / Location | `organizations` / `tenants` / `pharmacy_stores` |
| Coverage / Claim | Coverage / Claim | `insurance_memberships` + existing claims tables |

`FHIR_RESOURCE_MAP` already maps `Patient` → `Person`. Do not introduce a second Patient type in Core.

## Adapter rules (ADR 0003)

Official API → FHIR → HL7 v2 → approved middleware → read-only vendor DB (last resort).

Raw payloads belong in `interop_messages`. Provenance is mandatory. UgandaEMR/OpenMRS are adapters, not Core schemas.

## Delivery sequence

1. Stop advertising resources in CapabilityStatement that only 501 (or mark `status: draft` until Patient/Person read is real).
2. Implement Person read/search from `persons` + namespaced identifiers (Core review).
3. Encounter + MedicationRequest/Dispense once the clinical journey writes those aggregates.
4. Validate with profiles; never “JSON that looks like FHIR.”
