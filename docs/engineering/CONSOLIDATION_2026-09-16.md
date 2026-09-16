# Local repository consolidation — 2026-09-16

## Scope

Reviewed and committed the previously dirty RC1 work, merged it with the
existing integration branch, and checked all freshly fetched remote branch
tips for inclusion. Target is one local checkout on `main` at
`/home/ebrine/Desktop/SYNAPSE-OS`. No push, deployment, remote branch deletion,
or production/pilot database mutation is part of this operation.

Implementation under verification: `c239b7394ec89fc04d7bb90bab6acdee2a23edaa`.
Subsequent report/test-only commits do not change the built application code;
their recovered tests are run separately and recorded below.
This report supersedes the dirty-work exclusion and incomplete verification
status in [the initial integration report](BRANCH_INTEGRATION_2026-09-15.md).
That report's Vercel observations are historical, not a new deployment check.

## History and preservation

- `a6115e5`: reviewed retry, EHR-continuity and billing tests; preserved the
  uncommitted work with the safety corrections below.
- `0f5a99c`: retained the initial integration report.
- `1dd0bd5`: ordinary merge of reviewed RC1 work into integration.
- `c239b73`: consolidated regression commands in CI.
- Existing `d9bb72e` cache-privacy and workflow fixes remain included.
- Fresh remote tips: `origin/main` at `ac287a6`, RC1 acceptance at `5e8cde0`,
  invitation fix at `f861c9a`; all pass the ancestor check against integration.
  Earlier remote branch histories were retained in the prior integration;
  see its equivalence review rather than reapplying old squash-merged patches.
- All local branch tips are also ancestors. Branch references are kept for
  recovery; one working tree does not require deleting branch history.
- Original ignored local environment files are not modified or copied into
  the verification checkout.
- Reviewed `stash@{0}` (clinical cache privacy v4): runtime fixes are already
  represented by `d9bb72e`; recovered its additional worker/context tests,
  standalone browser fixture and historical evidence. Kept the stash intact
  for recovery. Equivalent CI assertions remain in the consolidation suite.

## Corrections required by review

1. **Triage primary-key ownership:** service-role vitals upsert uses the
   server-generated outbox UUID, not an attacker-selected command UUID.
   Existing command replay is bound to actor, tenant, facility, encounter,
   command type, schema version, base revision and payload hash.
2. **Amendment identity:** in-memory retry requires the same amendment ID and
   result/value/reason/actor. Removed fallback to an unrelated amendment.
3. **Collection retry:** the database adapter returns the completed collection
   without allocating another specimen, resetting specimen status, or
   rewriting verified results. Incomplete identifiers require reconciliation.
4. **Onboarding smoke safety:** no default production project, no automatic
   service-key retrieval. Requires explicit disposable opt-in, literal
   loopback URL and supplied disposable credentials. Direct fixture activation
   is explicitly not application invite-redemption, authentication or RLS proof.
   Failed provisioning may leave rows; dispose of the entire local test stack.
5. **Evidence scope:** EHR continuity is an in-memory fixture. Persisted HTTP
   amendment retry is still unproven; same-value amendments must not be
   silently treated as the same clinical act.
6. **CI:** retained separate shell commands and added the consolidation
   security regressions; all additions run rather than becoming arguments
   to a single folded command.

The Supabase/Next.js review guidance informed the primary-key, tenant-scope,
private-cache and disposable-test safeguards. Upsert behavior was checked
against the [official Supabase reference](https://supabase.com/docs/reference/javascript/upsert).

## Verification

Production credentials were unset for combined verification. No local `.env`
was copied into the integration worktree.

| Check | Result |
| --- | --- |
| Full `npm run verify` | PASS, exit 0; web and pharmacy production builds completed |
| Consolidation regressions (including recovered stash tests) | PASS: 19 script tests + 10 mocked route/adapter tests |
| Web production build | PASS: 287 static pages generated |
| Pharmacy verification | PASS: types/lint/build; 222 Vitest tests + 3 FEFO tests; 14 DB tests skipped |
| Control-plane tests | PASS: 115; 7 DB tests skipped |
| Web lint | PASS, zero warnings |
| Mobile type-check | PASS |
| Migration structure/history | PASS: 164 files; not full replay proof |
| Workflow/migration/reconciliation/readiness behavioral tests | PASS: 34 tests |
| Platform-admin guard scan | PASS |
| Disposable PostgreSQL invitation acceptance | PASS: 23 checks; container cleaned up |
| Additional lab persistence/report tests | PASS: 3 tests |
| Session-bound MFA tests | PASS: 4 tests |

The full verify command completed at `c239b73`. The subsequently recovered
test-only changes passed the expanded consolidation suite separately; future
`npm run verify` also runs it automatically through `preverify`.

**21 environment-dependent DB tests were skipped** because remote credentials
were intentionally absent. The separate 23-check PostgreSQL suite is real DB
coverage of invitations on a curated disposable schema, not a substitute for
those skipped tests. The recovered standalone browser fixture was syntax
checked, not rerun; its old evidence remains explicitly historical.

Local run logs (also copied into the original checkout's ignored
`artifacts/readiness/consolidation-2026-09-16/` directory before cleanup):

- `/tmp/synapse-consolidation-20260916-verify.log`
- `/tmp/synapse-consolidation-20260916-extra.log`
- `/tmp/synapse-consolidation-20260916-postgres.log`
- `/tmp/synapse-consolidation-20260916-lab-auth.log`
- `/tmp/synapse-consolidation-20260916-stash.log`

## Release limitations

Consolidation is not production clinical acceptance. New authenticated browser
journeys, full historical migration replay and pilot migration reconciliation
were not performed here. In particular, the lab HTTP amendment adapter still
generates new amendment IDs per request and does not reload amendment history:
in-memory idempotency tests do not prove persisted amendment retry safety.

The clinical cache fix intentionally prevents plaintext authenticated
HTML/JSON caching. Old evidence claiming a complete offline document reload
must not be reused for this implementation. Offline drafts and public static
assets are separate from an authenticated offline application shell.

Remote `main` remains at the fetched `ac287a6` until a separately authorized
release. A push may trigger Vercel; review staging acceptance, skipped DB tests,
migration reconciliation and the previously observed Node-version mismatch
before doing so.
