# RC1 browser lab + offline acceptance (disposable-rc1)

- **Branch:** `feat/rc1-lab-offline-acceptance`
- **Baseline tip when evidence captured:** post-blocker commits on this branch (see git log after `3df6697`)
- **Env:** disposable Postgres `synapse-rc1-lab-1433489` + PostgREST + Node `/rest/v1` proxy `:54322` + Next `:3011`
- **Not:** pilot/production Supabase, full migration parity, LIVE_PROOF, or deploy

## Commands

```bash
node scripts/rc1-browser-lab-acceptance.mjs
node scripts/rc1-browser-offline-writeup.mjs
npx vitest run apps/web/src/app/api/hospital/sync/apply/route.test.ts \
  apps/web/src/lib/clinical-offline/local-storage-outbox-store.test.ts
npm run lint --workspace @synapse/web
```

## Results

| Area | Result | Notes |
| --- | --- | --- |
| Lab browser UI journey | **PASS** 12/12 | collect→reject→replacement→result→tech deny→sci release→amend; cross-facility collect 400; unauth denied |
| Offline queue + encrypt | **PASS** | AES-GCM outbox; no plaintext HPI in localStorage |
| Real disconnected reload | **PASS** | SW v3 caches notes shell + `/_next/static`; encrypted draft snapshot restores queued HPI |
| Reconnect UI | **PASS** | notes usable after `setOffline(false)` |
| Logout park wrap | **PASS** | ciphertext + wrap/wrapIv; **no** `keyMaterial`; session key cleared |
| Required audit (unit) | **PASS** | sync/apply refuses `ok:true` when `requireHospitalAudit` fails; outbox left queued for idempotent retry |
| ESLint/ajv | **PASS** | `nest-eslint-ajv6` nests ajv@6.12.6; `npm run lint --workspace @synapse/web` exit 0 |
| `verify:web` | **PASS** | type-check + next build OK during full verify attempt |
| Full `npm run verify` | **FAIL (env)** | `verify:pharmacy` 4 integration suites fail against reduced disposable schema (missing `dob` / `pharmacy_products` / `hospitals`). `test:control-plane` invitation integration 7 fails similarly (`createFacilityInvitation` → ok false). Domain unit suites after pharmacy **PASS**. |
| Reduced schema ≠ prod | **NOT VERIFIED** as production | documented |

## Shared-device threat model (parked outbox)

- Wrap material = HMAC-SHA256(`SYNAPSE_JWT_SECRET`, `tenantId|actorId`) issued only on authenticated context/write-up GET.
- Another signed-in user gets different wrap material and cannot unwrap parked ciphertext.
- Residual: XSS or same OS user/profile can read origin storage (IndexedDB/localStorage/sessionStorage). Not OS multi-user isolation.

## Audit policy

See `docs/engineering/evidence/audit-policy-2026-09-13.md`.

## Screenshots / logs

`docs/engineering/evidence/browser-2026-09-13/` including `12-offline-reload.png`, `14-after-logout-park.png`, `offline-browser-log.txt`, `lab-browser-log.txt`.

## RC1 stance

**No-go** for production/LIVE_PROOF. Disposable browser + HTTP evidence is strong for the vertical slices tested; full verify is blocked by disposable schema coupling; lost-ack / signed-record UI+DB matrix and facility-switch E2E remain thinner than a release gate.
