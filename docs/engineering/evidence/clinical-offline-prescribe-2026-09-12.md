# Clinical offline prescribe — 2026-09-12

## Scope
Offline prescription as SyncCommand `clinical.encounter.prescribe.v1`.

Completes the offline clinical path: triage → write-up → prescribe → disposition.

## Proofs
- Domain golden: queue → apply → replay → conflict → signed reject
- HTTP: `POST /api/hospital/sync/apply` upserts `clinical_prescriptions`

## Run
```bash
npm run test:clinical-offline-prescribe
npm run test:hospital-sync-apply
```
