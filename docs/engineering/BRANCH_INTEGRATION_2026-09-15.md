# Branch integration and production comparison — 2026-09-15

## Scope and preservation

Integration worktree: `/home/ebrine/Desktop/SYNAPSE-OS-integration-20260915-qCG1XG`
Branch: `integration/all-branches-2026-09-15`
Implementation commit: `d9bb72e`.

The original checkout remains on `feat/rc1-lab-offline-acceptance` at
`5e8cde0`. Its 10 modified tracked files and 6 untracked files were preserved;
the uncommitted audit/triage/EHR/onboarding work was **not** silently bundled
into branch integration. This integration covers committed branch tips.

No push, PR mutation, production deployment, remote database writes, or branch
deletion was performed. A newly created disposable PostgreSQL test container
was removed by its runner after the test.

## Production vs repository — live read-only checks

| Surface | Serving commit | State |
| --- | --- | --- |
| [Main application](https://synapseos.tech) | `ac287a6` | READY |
| [Pharmacy](https://pharm.synapseos.tech) | `ac287a6` | READY |
| [Demo](https://demo.synapseos.tech) | `ac287a6` | READY |
| GitHub main (fresh fetch) | `ac287a6` | Does not include RC1 acceptance |
| RC1 acceptance preview | `5e8cde0` | READY preview; not production |
| Local integration implementation | `d9bb72e` | Not pushed or deployed |

During inspection, someone else's main-app redeployment changed from BUILDING
to READY. Deployment `dpl_7vNKNJ69gdw8geupXxUD4r4VMBZf` still serves
`ac287a634b4e3a5e6e78982081b87597c63c7da1`; it did not deploy new branch code.
Pharmacy deployment: `dpl_E56WnuQf5LKwX8e9GLN4TZ9TrZ8L`.
Demo deployment: `dpl_7qpipVbHAuTPapwdy9t5rebVGY74`.
RC1 preview deployment: `dpl_2vMd1RABxWNRFCyqBsXbMpwWSVD1`.

Existing [PR #77](https://github.com/ebrinejason-sys/SYNAPSE-OS/pull/77)
is open from RC1 acceptance to main.
[CI](https://github.com/ebrinejason-sys/SYNAPSE-OS/actions/runs/34748112989)
and [Deployment checks](https://github.com/ebrinejason-sys/SYNAPSE-OS/actions/runs/34748112991)
succeeded for `5e8cde0`, not this integration commit.

The main Vercel project currently reports Node 24.x configuration; the
repository, CI, and this local verification use Node 22 (local v22.23.2).
Runtime-version alignment remains a release review item, not silently changed.

## Merge method

1. Fresh `git fetch origin`.
2. Isolated worktree from origin/main, preserving the dirty original checkout.
3. Ordinary merge of RC1 acceptance into integration: `80338ad`.
4. Verified old squash-merged branches before recording ancestry:
   - Eleven branches have only patch-equivalent commits according to
     `git cherry 5e8cde0 <branch>`.
   - Extensive-lab branch tip `dfb8cc2` has an identical full tree to the
     already-integrated squash `778647d`.
   - Writeup/light branch tip `af15e3c` has an identical full tree to
     already-integrated squash `4ce5e6f`.
5. An ancestry-only `ours` merge records those thirteen already-integrated
   histories: `2762307`. This did not discard unique branch changes.
   `git diff HEAD origin/feat/rc1-lab-offline-acceptance` was empty immediately
   afterward.
6. All 21 fetched remote branch tips pass `git merge-base --is-ancestor <ref> HEAD`.
7. Local integration repair committed as `d9bb72e`.

| Fetched branch | Tip | Integration |
| --- | --- | --- |
| origin/chore/strip-landing-particle-field | edabd12 | included |
| origin/feat/hospital-golden-journey-runner | f8933ba | included |
| origin/feat/hospital-pilot-rc1-foundation | 985a654 | included |
| origin/feat/lab-golden-journey | ce35adc | included |
| origin/feat/opd-dispense-golden-journey | 5b4cc4d | included |
| origin/feat/opd-dispense-route-tests | e16305c | included |
| origin/feat/rc1-admin-sha-alignment | 6b62a9d | included |
| origin/feat/rc1-clinical-disposition-sync | 0b85cb7 | included |
| origin/feat/rc1-clinical-prescribe-sync | 90938ae | included |
| origin/feat/rc1-extensive-lab-admissions-live | dfb8cc2 | included |
| origin/feat/rc1-lab-offline-acceptance | 5e8cde0 | included |
| origin/feat/rc1-mfa-live-totp | fb2cfcf | included |
| origin/feat/rc1-referral-live-offline | 47c172a | included |
| origin/feat/rc1-referrals-domain | d24184d | included |
| origin/feat/rc1-surprise-triage-pulse | cd1e481 | included |
| origin/feat/rc1-sync-flush-mfa | 38a6166 | included |
| origin/feat/rc1-writeup-light-landing | af15e3c | included |
| origin/fix/facility-invite-legacy-raw-token | f861c9a | included |
| origin/fix/opd-dispense-live-stock | 11804e4 | included |
| origin/fix/rc1-triage-recordedBy-type | 1fb59a1 | included |
| origin/main | ac287a6 | included |

## Integration repairs

- Restored the missing clinical cache privacy fix. Authenticated notes HTML,
  write-up JSON, and outbox recovery material are no longer persisted in
  plaintext CacheStorage. Only public build assets are cached.
- Purge only legacy clinical worker caches, preserving unrelated app caches.
- Private/no-store headers on sensitive GET responses.
- Disconnected document reload now returns a neutral 503 reconnect message.
  Encrypted drafts remain intact. Historical offline-reload PASS evidence was
  explicitly superseded; this is **not** offline feature completion.
- Corrected a folded YAML `run` scalar that passed later `npm run` commands as
  arguments instead of running the seven clinical suites separately.
- Added missing RC1 suite invocations and privacy regression checks to CI.
- Fixed the write-up route test's missing recovery-material mock and asserted
  the cache-control boundary.

Vercel deployment/CI skills guided release-boundary separation; Next.js guidance
guided the sensitive route responses. Supabase safeguards kept live credentials
out of local verification. No authentication/RLS weakening or migration edits.

## Verification

- Clean dependency install: `npm ci --ignore-scripts --no-audit --no-fund`;
  then reviewed repository Expo/ESLint compatibility scripts run explicitly.
- Web production build: PASS, including types and 287 static pages.
- Web and pharmacy lint: PASS.
- Control-plane: 110 PASS, 7 real-Supabase tests SKIPPED (no configured test DB).
- Pharmacy unit/route/domain: 222 PASS, 14 real-DB tests SKIPPED; FEFO: 3 PASS.
- Isolated PostgreSQL invitation suite: 23 PASS (reduced prerequisite fixture,
  actual RPC execution, concurrency, rollback, grants; not full migration replay).
- Cache/CI regressions: 6 PASS.
- Write-up route and encrypted outbox: 6 PASS.
- Release-tool behavioral tests: 34 PASS.
- Migration static/history checks: 164 files, no structural/history errors;
  additive warnings remain separate from remote migration application.
- Platform admin guard scan: PASS.
- Full verification and pharmacy build: pending final outcome.

No test was pointed at production. Existing DB-dependent tests were left skipped
where configuration was absent, not relabeled as passing. Whole-platform browser
acceptance and complete historical migration replay were not performed.

## Release decision

Local committed branch consolidation is complete. This is **not permission or
evidence to promote production**. Before release:
- Finish full verification and resolve any failures.
- Configure isolated Supabase and run skipped database suites.
- Prove the full migration chain and reconcile intended deployed schema.
- Restore offline reload with a safe identity-aware shell and complete browser
  account/facility-switch, lost-acknowledgement and conflict acceptance.
- Review existing fail-open rate-limit warning observed in MFA unit output.
- Decide whether to include the separate uncommitted original-checkout work.
- Obtain explicit approval before pushing/updating PR #77 or promoting main.
