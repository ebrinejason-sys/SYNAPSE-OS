# DHIS2 Aggregate Export (Phase 0–1)

Outbound-only governed exports of **aggregate DataValueSets** to DHIS2 for Uganda MoH HMIS alignment.

## Principles

- **Never** send `PatientContextPacket` or identifiable patient data.
- Privacy gate + aggregation first; adapter push second.
- ICD-11 stems come only from the terminology service (`isKnownIcd11Stem`) — never invented.
- Default `DHIS2_MODE=simulation` outside production; simulation never opens a network socket to DHIS2.
- Synthetic / demo tenants are blocked from **live** push.
- Capability: `public_health.export_aggregate`.

## Period grain

| Grain   | Period format | Use |
|---------|---------------|-----|
| monthly | `YYYYMM`      | Default HMIS rollup |
| daily   | `YYYYMMDD`    | Facility ops (optional) |
| weekly  | `YYYYWww`     | Surveillance windows (Phase 2) |

Exact encounter timestamps and free-text complaints are stripped before export.

## Org unit mapping

`dhis2_org_unit_mappings` maps `local_org_key` (facility / hospital key) → DHIS2 organisation unit UID.

Until mappings are seeded, the platform trigger uses a simulation org unit (`OU_SIM_FACILITY`).

## Data element mapping

`dhis2_data_element_mappings` maps verified ICD-11 MMS stem → DHIS2 data element UID (and optional HMIS code).

Seed defaults in code cover malaria, pneumonia, TB, sepsis, typhoid, HIV for simulation. Production mappings must be MoH-approved.

## Job lifecycle

`pending → running → succeeded | failed → dead` (after max retries).

Idempotency key: `dhis2:{tenantId}:{orgUnit}:{period}:{dataSet}`.

Offline: facility can enqueue sync command `public_health.dhis2_export.v1` with an already privacy-gated payload; replay when online.

## Privacy rules

- `allowIdentifiable: false` (hard)
- Forbid names, patient/encounter/clinician IDs, free text, sub-period timestamps
- Optional `minCellCount` k-anonymity suppress
- Audit every enqueue / push / rejection in `dhis2_export_attempt_log` + platform `audit_log`

## Phase 2 / 3 hooks (TODO)

- Tracker / TEI / event programmes (stub interface only today)
- Cross-facility cluster aggregation via HIE/FHIR
- Catchment heat maps (analytics layer, not clinical path)
- Nightly cron worker claiming `pending` jobs
- Live MoH credential rotation + `liveEvidence` gate flip

## Operator runbook (simulation)

1. Ensure `DHIS2_MODE` is unset or `simulation`.
2. Sign in as platform admin → `/platform/dhis2`.
3. Click **Trigger aggregate export**.
4. Confirm a `succeeded` job with mode `simulation` and non-zero data values.
5. Optional API: `POST /api/platform/dhis2` with `{ "action": "trigger" }`.
