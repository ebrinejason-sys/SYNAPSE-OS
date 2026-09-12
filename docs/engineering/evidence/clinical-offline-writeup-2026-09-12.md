# Clinical offline write-up vertical slice — 2026-09-12

## Scope
Offline encounter write-up as SyncCommand `clinical.encounter.writeup.v1` on the existing sync-contract (no second offline system).

## Proofs
- Queue offline draft
- Apply into encounter metadata.writeup
- Idempotent replay (same commandId + hash)
- Conflict on same commandId with different payload hash

## Run
```bash
npm run test:clinical-offline-writeup
```
