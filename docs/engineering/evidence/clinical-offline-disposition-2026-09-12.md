# Clinical offline disposition — 2026-09-12

## Scope
Offline encounter disposition as SyncCommand `clinical.encounter.disposition.v1` on the existing sync-contract.

## Proofs
- Domain golden: queue → apply → idempotent replay → hash conflict → signed reject
- HTTP: `POST /api/hospital/sync/apply` accepts disposition (alongside write-up)

## Run
```bash
npm run test:clinical-offline-disposition
npm run test:hospital-sync-apply
```
