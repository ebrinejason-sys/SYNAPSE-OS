# ADR 0001 — Universal person identity is not a hospital MRN

## Status

Accepted

## Context

Facility MRNs, UgandaEMR ids, laboratory numbers and insurance member numbers are local. Treating `patient_id = hospital_number` makes cross-facility care, MPI and the patient app impossible without destructive migration.

## Decision

1. `persons.id` (UUID) is the immutable platform identifier.
2. `persons.synapse_id` is a human-readable label `SYN-{ISO3166}-{8 Crockford}{check}`.
3. Every external id is stored in `person_identifiers` with an issuer namespace.
4. `patients.mrn` and `pharmacy_customers` remain facility/pharmacy records and gain a nullable `person_id`.
5. Identical identifier strings from different issuers are different identifiers.

## Consequences

Registration creates both a person and a local MRN/customer row. Connectors record foreign ids without forcing HMS migration. Merges never discard identifiers.
