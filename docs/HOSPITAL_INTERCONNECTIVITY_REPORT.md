# Hospital Interconnectivity Report — 2026-08-30

## Chain analysis: can departments participate in one shared patient journey?

### Working chains (synthetic / Test Center)

**Malaria OPD Golden Journey** — PASS via `@synapse/db/malaria-golden-journey`

```
Reception (synthetic patient)
  → Encounter (OPD fever)
  → Intelligence (differential, no invented ICD)
  → ICD-11 (verified stem 1F40)
  → Diagnosis confirmed (clinician)
  → Pathway started (malaria)
  → Lab ordered (LOINC 58413-6)
  → Specimen collected → received
  → Lab result verified → released (clinician, not AI)
  → Pathway result received
  → Prescription created (Artemether/lumefantrine)
  → Pharmacy verify + dispense
  → Patient timeline populated
  → FHIR export (Patient, Observation, Condition)
```

One `correlation_id` across all steps. Evidence in Test Center.

### Broken chains

| From | To | Break point | Root cause |
|---|---|---|---|
| `/os/[slug]/encounters/new` | Encounters DB | Save fails | Called retired `POST /api/encounters` (410) — **FIXED** to use `POST /api/opd/triage` |
| Doctor orders | Lab worklist | No order appears | No UI + no WorkQueue routing from clinical to lab |
| Doctor prescription | Pharmacy queue | No dispense request | No `department_tasks` or `clinical_prescriptions` from clinical UI |
| Lab verified result | Doctor view | No notification UI | Results exist in simulation only |
| Pharmacy dispense | Inventory | Stock unchanged | Hospital dispense bypasses authoritative inventory RPC |
| Clinical activity | Billing | No charge | No clinical-to-billing service bridge |
| Admission decision | Ward assignment | No bed allocation | No admission workflow runtime |
| Platform golden journey | Hospital OS UI | Invisible to clinicians | Test Center is admin-only synthetic QA |

### New interconnectivity layer

**WorkQueue** (`packages/db/src/work-queue.ts`) — created this milestone:

- Canonical task fields: task_id, tenant_id, owner_department, task_type, priority, status, correlation_id, source_resource, source_id
- States: REQUESTED → ACCEPTED → IN_PROGRESS → ON_HOLD → COMPLETED / CANCELLED / FAILED
- `routeClinicalOrder()` — maps lab/imaging/prescription/admission/referral orders to department queues
- Emits domain events via ExchangeOutbox on create and complete
- Backed by `department_tasks` table (migration `20260830120000`)

**Not yet wired:** Clinical UI and APIs do not call `routeClinicalOrder()`. Next P1 fix.

### Event backbone status

Exchange outbox: OPERATIONAL  
37 domain event types: OPERATIONAL  
Correlation/causation IDs: OPERATIONAL  
Idempotency: OPERATIONAL (in-memory + DB schema)  
Event Explorer: OPERATIONAL (`/platform/events`)

### Timeline projection

16 event types in `packages/db/src/timeline.ts`  
Golden journey populates timeline  
No unified longitudinal UI for clinicians

### FHIR interconnectivity

Golden journey produces Patient, Observation, Condition  
HTTP handlers mixed (some 501, some implemented)  
CapabilityStatement may overstate readiness

### External system adapters

Simulation-only: eAFYA, UgandaEMR, ALIS, LabExpert, DHIS2, Insurer  
No live integration contracts

## Recommendation priority

1. Wire `routeClinicalOrder()` into OPD encounter save and order APIs
2. Connect Lab worklist UI to production DB + WorkQueue
3. Route prescriptions to pharmacy via `department_tasks`
4. Build minimum admission → bed → discharge chain
5. Add imaging simulation adapter (honest, no fake PACS)
