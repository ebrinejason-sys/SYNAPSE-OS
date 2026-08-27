# ADR 0006 — Modular monolith + Exchange outbox

## Status

Accepted

## Context

SYNAPSE modules were sharing tables without versioned contracts. Splitting into microservices now would freeze incomplete boundaries.

## Decision

1. Keep a modular monolith.
2. Introduce `synapse_domain_events` and an in-process `ExchangeOutbox` with idempotency.
3. Reuse `lab_orders` / `lab_specimens` / `patients` / `persons` rather than creating parallel clinical stores.
4. Classify demo tenants explicitly so simulation reset cannot target production.

## Consequences

Extracting Lab or Exchange later means promoting the outbox consumer, not rewriting schemas. FHIR remains a future adapter over canonical events, not a second database.
