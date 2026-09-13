# Hospital offline browser bridge — 2026-09-13

## Scope
Connect hospital web write-up UI to existing SyncCommand + `POST /api/hospital/sync/apply`.

## Implemented
- `MemorySyncOutboxStore` (`packages/db`) for unit/orchestrator tests
- `LocalStorageSyncOutboxStore` scoped by `tenantId` + `actorId`
- `queueWriteupOffline` / `flushHospitalClinicalOutbox` client
- `ClinicalWriteupPanel`: offline or failed online save → **queue** with explicit “not server-saved” copy
- Write-up GET returns `syncContext` from authenticated hospital staff context

## Proofs
- Domain SyncCommand suites (existing)
- `test:hospital-sync-apply` (mocked HTTP)
- `test:memory-sync-outbox` (commit/flush/replay/conflict + actor clear)

## Browser acceptance
**NOT VERIFIED** in automation (no Playwright e2e in this slice). Manual procedure: `docs/engineering/MANUAL_ACCEPTANCE_LAB_OFFLINE.md`.

## Explicitly NOT claimed
- Encrypted-at-rest browser storage
- Offline prescribe/triage/disposition UI wiring (builders exist; write-up is the connected surface)
- Live disconnect/reload/reconnect on pilot
