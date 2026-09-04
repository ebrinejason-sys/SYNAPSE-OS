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

The simulation seed contains `OU_SIM_FACILITY` for the synthetic facility. Production
organisation-unit UIDs come from MoH later and must not be inferred from local IDs.

## Data element mapping

`dhis2_data_element_mappings` maps verified ICD-11 MMS stem → DHIS2 data element UID (and optional HMIS code).

The simulation seed covers the known terminology stems for malaria (`1F40`), pneumonia
(`CA40`), tuberculosis (`1B10`), sepsis (`1G40`), typhoid (`1A07`), HIV disease (`1C62`),
hypertension (`BA00`), and diabetes (`5A21`). Diarrhoea and anaemia remain unmapped until
their verified ICD-11 stems are present in the terminology cache. Placeholder `DE_*`
values are simulation-only; production mappings must be MoH-approved.

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
- Live MoH credentials + `liveEvidence` gate flip
- Production org-unit / data-element seed from MoH HMIS dictionaries
- Facility offline replay UI for `public_health.dhis2_export.v1`

## Phase 2 (implemented)

- **EncounterSigned → rollup**: `scheduleDhis2RollupAfterEncounterSign` rebuilds monthly counts from signed `encounter_diagnoses` and refreshes the pending job payload.
- **Cron drain**: `GET /api/cron/dhis2-export` (23:00 UTC ≈ 02:00 Kampala) processes pending/failed jobs.
- **Manual drain**: `POST /api/platform/dhis2` with `{ "action": "process_pending" }`.

## Operator runbook (simulation)

1. Ensure `DHIS2_MODE` is unset or `simulation`.
2. Sign in as platform admin → `/platform/dhis2`.
3. Click **Trigger aggregate export**.
4. Confirm a `succeeded` job with mode `simulation` and non-zero data values.
5. Optional API: `POST /api/platform/dhis2` with `{ "action": "trigger" }`.
6. Confirm the monitor shows the last successful simulation period/value count and
	mapping coverage. For a deterministic test, run:
	`npx tsx --test packages/interop/src/dhis2/privacy-export.test.ts packages/interop/src/dhis2/rollup.test.ts packages/interop/src/adapters/dhis2.test.ts`.
