# SYNAPSE shared contracts

Status: **accepted**. Core/Grid owns these types. Feature agents consume them.

Authoritative TypeScript:

- `@synapse/db/contracts` and `@synapse/db/sync-contract`
- `@synapse/db/errors` — pharmacy domain error envelope
- `@synapse/db/identity`, `@synapse/db/mpi`, `@synapse/db/scope`, `@synapse/db/consent`, `@synapse/db/timeline`
- `@synapse/interop` canonical + clinical contracts

Do not create a second Person, Encounter, SyncCommand, or AuditEvent.

| Contract | Module | Notes |
|---|---|---|
| PersonIdentity | `@synapse/db/identity` + `PersonIdentity` in sync-contract | UUID is immutable; SYNAPSE ID is the label |
| FacilityContext | `@synapse/db/scope` | `facilityId` = `tenants.id` |
| Encounter | `@synapse/interop` `clinical-contracts` | TypeScript only — not an operational UI |
| ClinicalObservation | `@synapse/interop` | Provenance required |
| Condition | `@synapse/interop` | ICD-11 preferred code system |
| MedicationRequest | `@synapse/interop` | Prescription |
| MedicationDispense | `@synapse/interop` | Linked to pharmacy sale when fulfilled in SYNAPSE |
| ServiceRequest | `@synapse/interop` | Lab/imaging/procedure |
| DiagnosticResult | `@synapse/interop` | Report + observations |
| AuditEvent | `@synapse/db/sync-contract` | Complements `logAudit` |
| SyncCommand / SyncEnvelope | `@synapse/db/sync-contract` | ADR 0004 |
| PharmacyDomainError | `@synapse/db/errors` | Machine-readable pharmacy failures |
| TimelineEvent | `@synapse/db/timeline` | Publish, do not fork timelines |

## Sync non-negotiables

1. A UI may not report a mutation saved until the command is durably committed locally.
2. Server processing is idempotent on `commandId` + `payloadHash`.
3. Last-write-wins is forbidden for clinical, financial, and inventory aggregates.
4. Web POS currently throws `OfflineUnavailableError` until the offline owner ships persistence.

## Capability claims

UI copy must match `docs/implementation/capability-registry.json`. If status is `PLANNED`, do not ship an operational screen for it. `OPERATIONAL` requires implementation, tests, security review, live verification, and failure-mode verification.
