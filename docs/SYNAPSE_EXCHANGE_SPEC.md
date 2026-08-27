# Synapse Exchange spec

Events are versioned. Idempotency key: `{event_type}:{tenant_id}:{aggregate_id}:{action}`.

Envelope fields: `event_id`, `event_type`, `version`, `tenant_id`, `facility_id`, `actor_id`, `patient_id`, `encounter_id`, `timestamp`, `correlation_id`, `causation_id`, `payload`, `source`, `idempotency_key`. Synthetic runs also set `is_synthetic` and `simulation_run_id`.

Minimum event types are defined in `packages/interop/src/events.ts`.

Outbox statuses: `pending` → `published` | `failed` → retry → `dead` after 8 failures.

Correlation example:

```
EncounterCreated
  → ClinicalPathwayStarted
  → LabOrderCreated
  → SpecimenCollected
  → SpecimenReceived
  → LabResultVerified
  → CriticalLabResultDetected
  → PrescriptionCreated
  → MedicationDispensed
```

Patient identifiers are masked in the Platform Control Center explorer.

FHIR HTTP resources remain **roadmap** (501). Canonical TypeScript contracts in `@synapse/interop` are not a claim of FHIR compliance.
