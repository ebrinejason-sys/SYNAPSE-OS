# Public Health & DHO Surveillance (Phase 9)

Replace the "three diagnosis rows = cluster" prototype (audit §5: `count >= 3` in the page, never
in SQL). A cluster is first a **surveillance signal**, never an official outbreak decided by AI.

## Signal classification inputs
Symptom onset date, encounter date, residence/exposure location, facility location,
radius/geographic cell, time window, syndrome, ICD-11 diagnosis, laboratory confirmation, baseline
incidence, seasonality, duplicate visits, patient movement, household/school/workplace links, age
and sex, severity, mortality, population denominator, data quality.

## Signal state machine
`detected → under_review → dismissed | investigation_opened → probable_cluster →
laboratory_supported → confirmed_outbreak → closed`.
**Only authorised epidemiologists/DHOs may confirm an outbreak.** AI/rules may raise up to
`probable_cluster` but never `confirmed_outbreak`.

## Configurable rules engine
No hard-coded universal "three cases" threshold. Rules are per-syndrome/district/time-window with
baseline + seasonality inputs, stored and versioned, evaluated on a schedule.

## DHO portal
District dashboard, confirmed + suspected cases, syndromic signals, epi curves, geographic
aggregation, age/sex distribution, lab status, mortality, facility reporting delays, data-quality
warnings, investigation queue, assign surveillance officer, line-list generation, sample tracking,
contact follow-up, field notes, resource requirements, bulletin generation, DHIS2 export, CSV/PDF.
**Privacy:** protect exact household locations; use privacy-preserving map aggregation except for
authorised investigation roles. Synthetic tenants never export to real DHIS2.

See also: [dhis2-export.md](./dhis2-export.md) for Phase 0–1 aggregate DataValueSet pipeline.

## Migration shape (additive)
`surveillance_signals` (state machine + inputs above), `surveillance_rules` (versioned config),
`outbreak_confirmations` (role-gated), and a proper `surveillance_reports` DDL (currently RLS-only,
no table in migrations). DHIS2 export via an adapter with a synthetic-tenant guard.
