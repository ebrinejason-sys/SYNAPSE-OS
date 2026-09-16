# Clinical cache privacy repair — 2026-09-13

Historical evidence recovered from `stash@{0}` on 2026-09-16. Results below
belong to that earlier local run, not the consolidated release. See
`docs/engineering/CONSOLIDATION_2026-09-16.md` for current verification.

Base: `5e8cde0`, branch `feat/rc1-lab-offline-acceptance`; verification below
was run against the local working changes, not a deployed or committed release.

## Finding and change

The v3 service worker persisted authenticated write-up JSON (clinical notes and
`syncContext.outboxWrapMaterial`) and notes HTML in plaintext CacheStorage.
Lookup used the request URL, not an enforced actor/tenant boundary. Logout
parking/encrypting the outbox did not protect this separate cached copy.
Activation also deleted unrelated origin caches.

The v4 worker caches only public Next build assets. Clinical write-up/context
GETs and notes navigation are network-only, without CacheStorage read/write.
Activation removes only this worker's older caches, including its plaintext
API/HTML stores; unrelated app caches are preserved. Redirected, private,
no-store, HTML, and unsuccessful asset responses are not cached.
Both served worker copies remain identical and are covered by a regression.

Sensitive GET responses now explicitly send `Cache-Control: private, no-store`
and `Vary: Cookie, Authorization`. Headers alone would not fix the worker:
[CacheStorage does not honor HTTP caching headers](https://developer.mozilla.org/en-US/docs/Web/API/Cache).

No encrypted outbox or draft storage was deleted or reformatted. The Next.js
route-handler guidance informed the response headers; the CI guidance informed
the separate shell commands and required regression gate.

## Deliberate acceptance change

Disconnected document reload now returns a neutral 503 reconnect message,
not a cached authenticated document. The earlier v3 offline-reload PASS is
superseded: a non-personalized offline shell with safe identity/recovery handling
is required before restoring that feature. An already-loaded form and its
encrypted drafts were not redesigned here; this is not full offline acceptance.

Existing installations receive cache cleanup when the updated worker activates.
No deployed browser storage was inspected or purged by this local task.

## Verification performed

- `npm run test:clinical-cache`: 10 worker behavior + 5 mocked route tests PASS.
- Focused Vitest outbox, lab actions, and hospital sync/apply: 23 PASS.
- `npm run test:workflow-safety`: 7 PASS, including parsed YAML assertions.
- `node scripts/check-clinical-cache.browser.mjs`: PASS in Chromium using a
  fresh browser context and synthetic loopback server. Proves legacy-cache
  cleanup, non-persistence of sensitive responses, offline denial, public-asset
  caching, and reconnect. No application sessions or database were involved.
- Browser caveat: page-level offline emulation initially left service-worker
  fetches online. The fixture also terminates network sockets during the
  disconnected phase; assertions were retained, not relaxed.
- Web TypeScript and lint: PASS.
- `npm run db:check`: 164 migration files pass static checks only.
- `git diff --check`: PASS.

The CI clinical test list previously used a folded YAML scalar, passing later
`npm run` commands as arguments to the first command. It now uses a literal
multiline block. Cache regressions are included in CI and local `verify`.

Full `verify`, production build, full migration replay, deployed-state checks,
and full authenticated browser/tenant acceptance were not run this round.
No database, deployment, push, or commit operations were performed.

## Next gate

RC1 remains no-go: safely restore disconnected page loading; complete real
account/facility-switch browser acceptance; resolve the complete migration/test
environment and run full verification. Do not use the old browser evidence to
promote this working tree to offline-ready.
