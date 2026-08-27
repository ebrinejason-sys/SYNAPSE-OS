# SYNAPSE Architecture 2026

SYNAPSE is a **modular monolith** with event-driven contracts. Do not split into microservices until a boundary has a second runtime that needs independent scale.

```
Patients / Professionals / Facilities
        ↓
 SYNAPSE PRODUCTS (OS, Pharm, App)
        ↓
 SYNAPSE CORE (identity, tenancy, consent, audit)
        ↓
 SYNAPSE EXCHANGE (versioned domain events + outbox)
        ↓
 Clinical ─ Lab ─ Pharm ─ Pathways ─ Finance
        ↓
 Shared longitudinal timeline (source references, not a second EHR)
        ↓
 Analytics / AI (advisory) / Public health (roadmap)
        ↓
 External systems (FHIR, DHIS2, ALIS, UgandaEMR) — adapters, not shared tables
```

## Canonical identity

`persons.id` is the platform primary key. `persons.synapse_id` is the human label. Facility MRNs, UgandaEMR ids, lab numbers and insurance ids are aliases in `person_identifiers` with an issuer namespace. Automatic merge is forbidden (`shouldAutoMerge` returns false).

See ADR 0001 and `packages/db/src/identity-crosswalk.ts`.

## Module communication

Modules publish `DomainEventEnvelope` records through `ExchangeOutbox`. Callers must not treat a second SQL table as the other module's API. Persistence maps to `synapse_domain_events`.

## Clinical safety

- AI never signs notes, never verifies lab results, never dispenses.
- Verified lab results are amended, not overwritten.
- Pathway recommendations are overridable; overrides set `may_train_models = false`.
- Demo reset requires `environment = demo` and `is_synthetic = true`.

## Offline

Edge pipeline (device → encrypted local DB → durable queue → sync → conflict → server) is **roadmap**. Pharmacy web offline checkout is **disabled**.
