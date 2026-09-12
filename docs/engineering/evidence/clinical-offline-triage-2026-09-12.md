# Clinical offline triage — 2026-09-12

## Scope
Offline nurse triage + vitals as SyncCommand `clinical.encounter.triage.v1` (completes offline clinical trio with write-up + disposition).

## Proofs
- Domain golden: queue → apply → replay → conflict → signed reject
- HTTP: `POST /api/hospital/sync/apply` persists `metadata.triage`, `clinical_stage`, and a `vitals` row

## Run
```bash
npm run test:clinical-offline-triage
npm run test:hospital-sync-apply
```
