# Platform Test Center

**Surface:** `/platform/test-center` on admin.synapseos.tech  
**Auth:** `requirePlatformAdmin` (page) · `requirePlatformAdminApi` (API)

## Purpose

The Universal Test Center lists SYNAPSE modules with honest latest-run status. It does **not** treat env presence or SKIPPED as PASS.

Statuses: `PASS` | `FAIL` | `BLOCKED` | `NOT_CONFIGURED` | `SKIPPED`

## Malaria Golden Journey

Authoritative runner: `@synapse/db/malaria-golden-journey` (`executeMalariaGoldenJourney`).  
One `correlation_id` across Clinical → Intelligence → ICD-11 → Pathway → Lab → Timeline → Prescription → Pharm → FHIR.

| Step | Meaning |
|---|---|
| `patient_registration` | Synthetic patient + markers |
| `encounter_open` | OPD fever/chills/headache |
| `history_vitals` | Temp ~39.4 |
| `intelligence_recommendation` | Kernel differential; invented ICD stripped |
| `icd11_lookup` | Verified stem (e.g. `1F40`) |
| `diagnosis_confirmed` | Clinician selection |
| `pathway_started` | `pathway.malaria` |
| `lab_ordered` | LOINC `58413-6` |
| `specimen_workflow` | Collect → receive |
| `lab_result_released` | Positive → verify (clinician, not AI) → release |
| `pathway_result_received` | Pathway interpret step |
| `prescription_created` | Artemether/lumefantrine |
| `pharm_dispense` | Verify + dispense |
| `patient_timeline` | Timeline events |
| `fhir_export` | Patient + Observation (+ Condition) |

Simulation Lab scenario `opd-malaria` uses the same core.

### How to run

1. Sign in as platform admin with MFA.
2. Open **Test Center** in the admin sidebar.
3. Click **Run Malaria Golden Journey**.

```
POST /api/platform/test-center/golden/malaria
```

The API:

- Creates a synthetic demo hospital tenant (`is_synthetic: true`)
- Calls `runMalariaGoldenJourneyForPlatform` → `executeMalariaGoldenJourney`
- Best-effort persists domain events for Event Explorer
- Persists evidence to in-memory store + `audit_log` (and `platform_test_runs` if migrated)
- Returns step timeline, `correlation_id`, duration, and status

Alternate API (pass your own demo `tenantId`):

```
POST /api/platform/golden-journey/malaria
{ "tenantId": "<demo-uuid>", "seed": 20260829 }
```

### Follow the evidence

- Step timeline on the Test Center page
- Event Explorer: `/platform/events?correlationId=<id>`
- Lab Monitor: `/platform/lab`
- Audit log: action `test_center.run`

## Module list

| Module | Default status | Notes |
|---|---|---|
| Core … Offline | `NOT_CONFIGURED` until a run updates them | Golden malaria updates Clinical, Intelligence, ICD-11, Pathways, Lab, Pharmacy, FHIR, Exchange |

## Honesty rules

- No fake GREEN health
- No secrets in API responses
- SKIPPED never counts as PASS toward overall journey status
- Key present ≠ HEALTHY (OpenRouter is live-probed on Intelligence page)

## Related pages

- `/platform/intelligence` — provider probes + synthetic eval
- `/platform/icd11` — WHO ICD-11 MMS 2026-01 probe
- `/platform/lab` — lab table probes + golden lab events
- `/platform/deployments` — GitHub / Vercel SHA truth
- `/platform/health` — production-truth panel
