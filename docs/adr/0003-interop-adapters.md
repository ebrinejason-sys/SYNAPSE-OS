# ADR 0003 — Interoperability through adapters, not vendor types

## Status

Accepted

## Context

Facilities already run OpenMRS, UgandaEMR, LIS products and insurance systems. Embedding those payloads in core tables would freeze SYNAPSE to one vendor.

## Decision

Core domain is a SYNAPSE canonical model (`Person`, `Encounter`, `Observation`, …). `@synapse/interop` adapters translate FHIR, HL7 v2, ASTM, OpenMRS and UgandaEMR. Raw messages are stored in `interop_messages` / `lab_analyzer_messages` for audit. Direct database access is last in the integration preference list.

## Consequences

A new HMS is a new adapter. Analyzers speak accession numbers to a local lab gateway. SYNAPSE never requires an analyzer on the public internet.
