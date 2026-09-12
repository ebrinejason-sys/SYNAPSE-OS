# Hospital sync apply (write-up) — 2026-09-12

## Scope
HTTP flush for SyncCommand `clinical.encounter.writeup.v1` under hospital staff auth.

## Endpoint
`POST /api/hospital/sync/apply`

## Semantics (mirrors pharmacy mobile sync/apply)
- Assert SyncCommand + payload hash
- Scope: `tenantId` + `actorId` must match hospital session
- Outbox `offline_mutation_outbox`: insert → syncing → applied
- Idempotent **replay** on same commandId + hash
- **Conflict** (409) on same commandId with different hash
- Reject signed encounters (`ENCOUNTER_SIGNED_IMMUTABLE`)
- Apply via `applyWriteupSyncCommand` + compose `clinical_note` into encounter metadata
- Audit hospital UPDATE

## Proof
```bash
npm run test:hospital-sync-apply
# also included in npm run test:control-plane and npm run verify
```

Vitest covers: unauth, unsupported type, scope mismatch, bad hash, apply+audit, replay, conflict, signed reject.
