# PROJECT GOLDEN — 2026-08-28

Branch: `cursor/project-golden-bf39`

SYNAPSE is no longer racing to be “eAFYA with more pages.” It is the intelligence, clinical orchestration and interoperability layer that can:

1. **Native** — run a facility (OS / Lab / Pharm / App)
2. **Overlay** — sit beside eAFYA, UgandaEMR, ALIS or another EMR
3. **Network** — coordinate facilities through Synapse Exchange adapters

## What this milestone implemented

- Capability **GREEN gates**. Public comparison Synapse cells come from `packages/config/src/capability-gates.ts`. A cell is Yes only when every check passed **and** `liveEvidence` is true. `liveEvidence` is false for every gate. The landing page no longer hardcodes `synapse: 'yes'`.
- **Intelligence kernel** (`packages/interop/src/intelligence/kernel.ts`) wrapping the existing reasoning types. AI outputs are structured recommendations. Clinician ACCEPT / MODIFY / REJECT / DEFER. AI cannot sign, release labs, dispense, or submit claims. Model-emitted ICD codes are stripped.
- **ICD-11 2026-01 terminology service** with a local MMS cache and optional official WHO API. Credentials stay server-side. Outage falls back to cache.
- **FHIR R4 flagship mappers** for 11 resources. Honest draft CapabilityStatement. Immunization / AllergyIntolerance remain 501. Tenant session required. Empty search bundles until records exist — not fake data.
- **Adapter SDK** plus labelled **simulation** adapters (eAFYA, UgandaEMR, ALIS, LabExpert, DHIS2, insurer) with injectable network faults.
- Pathways: **sepsis, malaria, DKA, pneumonia**. AI may recommend activation; a clinician must start the plan.
- Insurance check/claim routes wired to the existing copilot + a scrubber that rejects unverified ICD-11. No auto-submit.
- Diagnose route no longer writes with caller-supplied `tenantId` + service-role.
- Overlay golden journey test: mock eAFYA patient → Exchange → Intelligence → clinician-confirmed ICD-11 → malaria pathway → lab event → FHIR Patient/Observation.

## Intentionally not GREEN

Pharm remains an operational candidate. FHIR, ICD-11, AI, offline, DHIS2, and insurance are development/partial until live proof. Simulation adapters are not Ministry integrations.

## Database

- `20260828090000_synapse_exchange_lab_pathways_simulation.sql` (PR #53) — apply to staging/production if missing.
- `20260828120000_project_golden_intelligence_icd11.sql` — ICD-11 cache, intelligence audit, adapter registry.

## Next

P0: confirm Exchange migration RLS on live. P1: WHO credentials, clinician coding UI, FHIR tenant round-trip, live payer-less claim review UI. P2: real eAFYA/ALIS contracts when available; swap simulation transport.
