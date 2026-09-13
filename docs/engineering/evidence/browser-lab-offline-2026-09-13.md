---
result: PARTIAL
environment: disposable-rc1
sha: 
scope: browser-lab-ui+offline-writeup-partial
recordedAt: 
proofKind: browser
browserLabJourney: PASS
browserOfflineWriteup: PARTIAL
rc1Complete: false
---

# Browser + security acceptance (disposable-rc1) — 2026-09-13

## Environment (reduced schema — NOT production parity)
- Branch tip before these commits: ``
- Next `http://127.0.0.1:3011` + PostgREST `54321` + `/rest/v1` proxy `54322`
- Disposable Postgres docker label `synapse.disposable-test=true` (name confirmed via `docker ps` + inspect, not blind `/tmp` rm)
- Missing full migration history tables (e.g. `department_tasks`, `synapse_domain_events`, `billing_invoices`) — journeyWarnings only; HTTP/browser PASS ≠ full schema reproducibility
- Pilot project `qfqakzmjatszisuqjwon` **not** touched; no push/PR/deploy

## Commands
- `node scripts/rc1-browser-lab-acceptance.mjs`
- `node scripts/rc1-browser-offline-writeup.mjs`
- Concurrent replace: two parallel `POST /api/opd/lab-orders` with same `replaces_lab_order_id` → **201 + 409**, one open child
- Cross-facility replace → **404** `Replaced lab order not found`
- Cross-facility collect → **400** `LAB_ORDER_NOT_FOUND`
- Signed encounter sync/apply → **409** `ENCOUNTER_SIGNED_IMMUTABLE`
- Focused: `npm run test:lab-actions` (6), `test:rc1-pulse` (4), `test:clinical-offline-writeup` (1), `test:hospital-sync-apply` (11), close route (3) — all PASS
- `npm run type-check --workspace @synapse/web` — PASS
- `npm run lint --workspace @synapse/web` — **FAIL tooling**: ESLint 9 `ajv` `defaultMeta` TypeError (environment), not a rule violation report

## Lab browser UI — PASS
Screenshots under `docs/engineering/evidence/browser-2026-09-13/`.
Flow exercised via Playwright against real pages `/lab/orders`, `/lab/verify`, `/lab/results`, `/encounter/{id}/notes`:
collect → receive → **Reject** (new UI) → doctor replacement → collect/receive/enter → lab_tech verify denied → scientist verify/release → **Amend** (new UI).
DB: parent `REJECTED`; child `AMENDED` with `replaces_lab_order_id`; result `Negative`/`corrected` v2; reports FINAL v1 + AMENDED v2.

## Offline browser — PARTIAL
PASS: offline save shows queued/not server-saved; AES-GCM ciphertext in tenant+actor localStorage key; no plaintext HPI; session key in sessionStorage while active; no other-actor keys; reconnect UI usable; **Sign out parks outbox + clears session key + retains keyMaterial for same-actor restore**.
LIMIT: Playwright cannot `reload` while `setOffline(true)` (`ERR_INTERNET_DISCONNECTED`) — used storage surrogate.
NOT DONE: lost-ack/retry UI matrix, conflict UI surfacing, facility switch, prescribe UI E2E, full flush-after-reconnect assertion of single server row.

## Security review
### Encrypted outbox
- Key in `sessionStorage`; ciphertext in `localStorage` scoped `tenantId:actorId`.
- Logout parks + clears live key; park blob now includes `keyMaterial` so same actor can restore after re-login (**residual risk**: same browser profile can read park+key from localStorage — better than silent PHI loss; not a cross-user web session leak if park keys differ by actor).
- XSS while logged in can still read session key (inherent to browser crypto).

### logHospitalAudit
- Replaced invalid `.catch` on PostgREST builder with try/catch; still **best-effort** (does not fail clinical writes if `audit_log` missing). Disposable DB lacked `audit_log` initially — created for acceptance. Does **not** claim immutable audit under reduced schema.

### Route consolidation `[encounterId]` → `[id]`
- No leftover `[encounterId]` directory; close/disposition/sign/write-up/amend under `[id]`; close tests PASS.

### Replacement constraints
- Concurrent open replacements: one succeeds, one 409.
- Cross-facility parent: 404.

## Remaining blockers (RC1 not complete)
1. Prescribe offline UI E2E
2. Offline conflict / lost-ack / facility-switch browser matrix
3. Full `npm run verify` + production build confirmation
4. Lint toolchain repair (ajv/eslint)
5. Disposable ≠ production schema; do not promote LIVE_PROOF from this alone without named full-stack env

## Staging recommendation
**No-go** for RC1 finish line / production-ready. Disposable browser lab path is strong evidence for lab UI+auth negatives; offline is partial; reduced schema caveats apply.
