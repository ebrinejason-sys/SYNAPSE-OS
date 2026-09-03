# SYNAPSE Lab Architecture (2026)

## Purpose

SYNAPSE Lab is a Laboratory Information Management System that can operate as:

1. Independent diagnostic laboratory  
2. Hospital laboratory module  
3. Multi-site / reference laboratory  
4. Interconnected lab receiving Synapse OS or external orders  

Analyzer connectivity is first-class via **Lab Edge** (LAN gateway), not cloud serial ports.

## Bounded contexts

| Context | Responsibility |
|---------|----------------|
| **Lab Core** | Patients/clients, orders, catalogue, specimens, accessioning, worklists, results, verification, release, reports, amendments, critical values, billing, audit |
| **Lab Quality** | IQC, EQA/PT, calibration, reagent lots, QC rules, equipment maintenance |
| **Lab Device Gateway (Edge)** | Analyzer connectivity, framing, parsing, mapping, reconciliation, staging, device health |
| **Synapse Exchange** | FHIR, EMRs, hospitals, referrers, national reporting |

Analyzer protocol code must not live inside Lab Core.

## Order state machine (preserved)

Defined in `packages/db/src/lab-workflow.ts`:

`ORDERED → COLLECTION_PENDING → COLLECTED → IN_TRANSIT → RECEIVED → REJECTED | PROCESSING → RESULT_ENTERED → VERIFICATION_PENDING → VERIFIED → RELEASED ↔ AMENDED · CANCELLED`

Do not rebuild unless a genuine defect is proven. Harden with durable Postgres persistence.

## Persistence rule

`LabWorkflow` = transition engine (in-process).  
**Postgres** = authority after every action (`lab_orders`, `lab_specimens`, `lab_results`).

Hospital action path: `apps/web/src/lib/hospital-lab-db.ts` loads prior results before transitions and upserts results/specimens.

## Analyzer pipeline

```
RAW → PARSED → MAPPED → MATCHED → VALIDATED → STAGED → REVIEWED → VERIFIED → RELEASED
```

Parsers never write released results. Unmatched accessions stay in `UNMATCHED` staging — never match by patient name alone.

## Waves

| Wave | Focus |
|------|-------|
| **1** | Durable results/specimens, real Lab UIs, RBAC, accession sequences |
| **2** | Lab Edge, device registry, raw messages, ASTM/HL7, mapping, simulators |
| **3** | First physical driver, validation mode, observability, offline queue |
| **4** | QC, reagents, calibration, equipment |
| **5** | Discipline extensions (micro, molecular, histo) |
| **6** | Reference lab, multi-site, advanced offline |

## Key routes

- `/lab/orders` — worklist  
- `/lab/specimens` — accession / barcode scan  
- `/lab/results` — durable results  
- `/lab/verify` — human verification queue  
- `/lab/instruments` — device registry  
- `POST /api/lab/instrument-ingest` — Edge → raw store + staging (bridge API key)

## Related docs

- `docs/LAB_DEVICE_GATEWAY.md`  
- `docs/LAB_ANALYZER_DRIVER_SDK.md`  
- `docs/LAB_ASTM_INTERFACE.md`  
- `docs/LAB_HL7_INTERFACE.md`  
- `docs/LAB_MACHINE_VALIDATION.md`  
