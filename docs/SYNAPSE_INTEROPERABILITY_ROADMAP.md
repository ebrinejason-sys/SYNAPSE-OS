# Interoperability roadmap

| Adapter | Status | Truth |
|---|---|---|
| FHIR R4 | ROADMAP | Canonical TS map exists. HTTP resources return 501. CapabilityStatement is a mock. |
| ICD-11 | DEVELOPMENT | `icd11_code` on diagnoses. Not a terminology server. |
| LOINC | DEVELOPMENT | Columns + a small demo range set. |
| SNOMED CT | ROADMAP | Not licensed/loaded. |
| DICOM | ROADMAP | No PACS gateway. |
| HL7/ASTM instruments | DEVELOPMENT | Parsers in `@synapse/interop`. Ingest route remains a mock until a worker exists. |
| DHIS2 | ROADMAP | Pending-row export only. |
| ALIS | ROADMAP | Future LIS adapter; SYNAPSE does not replace ALIS. |
| UgandaEMR / OpenMRS | ROADMAP | Identifier namespace reserved. |
| eAFYA / IRRDS | ROADMAP | Named only. |
| Insurers | DEVELOPMENT | Internal claims concepts. No live payer gateway. |

Preference order remains: official API → FHIR → HL7v2 → approved middleware → read-only database last (`packages/interop/src/adapter.ts`).
