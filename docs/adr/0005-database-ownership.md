# ADR 0005 — Database ownership and additive schema

## Status

Accepted

## Context

Live SYNAPSE_OS already contains pharmacy POS tables, identity foundations, and inventory-authority RPCs. Parallel agents inventing tables for Person, Encounter, or stock will duplicate concepts and break RLS.

PR `#38` edited `20260817120000_synapse_network_identity_foundations.sql` in place. If that file is already applied live, in-place edits never re-run.

## Decision

1. Only Core (Lead Architect / designated database owner) may introduce foundational entities: persons, identifiers, facilities, roles, clinical events, inventory/financial ledgers, sync, audit, FHIR mappings.
2. Feature agents may **propose** SQL. Core must review before apply.
3. Before creating a table, search live schema and `supabase/migrations`.
4. Migrations are additive and reversible. Do not recreate live pharmacy POS tables.
5. Never edit an already-shipped migration in place. Ship a new timestamped file.
6. `complete_pharmacy_sale` and identity `generate_synapse_id` overloads have a single owner.
7. Do not replace or revoke live zero-arg `generate_synapse_id()` used by `patient_profiles`.

## Consequences

Specialty packs extend Encounter / Ward / Medication services. They do not create `patients2` or a second stock ledger.
