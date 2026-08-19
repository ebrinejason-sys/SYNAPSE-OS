# Core/Grid, terminology, FHIR, clinical journey, Edge

Status: **research / design only**. Do not introduce conflicting foundations before Core schema decisions.

These notes bind future agents to existing contracts in `docs/architecture/contracts.md` and ADRs 0001–0005.

## Core/Grid

Extend, do not replace:

- `persons` / `person_identifiers` / MPI (`shouldAutoMerge` is always false)
- `tenants` as facilities + `organizations` + `pharmacy_stores` as sites
- `staff_scope_assignments` + JWT tenant isolation
- `patient_timeline_events` as the longitudinal bus
- `offline_mutation_outbox` + `SyncCommand`

Next Core work (after Milestone A persistence): snapshot live pharmacy DDL into a baseline migration; regenerate `packages/db/src/types.ts` for `persons`.

## Terminology

ICD-11 and WHO SMART-guideline **compatibility** (no endorsement claim). Credentials stay server-side. Cache + release versioning before any browser bundle. Do not hardcode Uganda-only codes into Core types; country packs later.

## FHIR

Today: CapabilityStatement plus HTTP 501 stubs. Target: profile-driven validated FHIR that maps to `@synapse/interop` canonical types (`Patient` → `Person`). Adapters already exist as interfaces for OpenMRS / UgandaEMR / HL7 / ASTM.

## Clinical journey

One journey, not twenty departments:

Registration → Queue → Triage → Consultation → ICD-11 → Orders → Lab/imaging → Results → Prescription → Pharmacy → Billing → Discharge/referral → Follow-up

Doctor/nurse/lab routes are currently placeholders. Do not add more fake department pages. Ward architecture is Facility → Department → Ward → Room → Bed plus a reusable ADT engine after the journey slice.

## Edge

A hospital with LAN and no internet keeps essential workflows. Edge is a local authority that speaks the same `SyncCommand` protocol. It is not a second pharmacy schema. Multi-counter stock during WAN loss waits for Edge; single-counter durable POS is Milestone A.
