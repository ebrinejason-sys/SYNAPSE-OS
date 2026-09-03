# Laboratory Platform Onboarding (2026)

## Goal

First-class `facility_type = laboratory` foundation for Synapse Lab without regressing Lab Wave 1/2 work (results, specimens, accessions, verification, device staging, Lab Edge scaffold).

## Defaults

Modules:

- core, registration, lab, billing, reports
- optional: claims, public_health, migration

Explicitly **not** enabled by default: OPD, IPD, maternity, theatre.

## Provisioning path

`provisionFacility(..., facilityType: "laboratory")` reuses the durable hospital adapter for tenant/departments/admin/invite, then sets `facility_type=laboratory`.

Analyzer transport is out of scope for this control-plane milestone.
