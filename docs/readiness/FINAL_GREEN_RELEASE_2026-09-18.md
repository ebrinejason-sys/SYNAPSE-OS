# Final Green + Demo product experience — 2026-09-18

**Status:** CURRENT  
**FINAL MAIN SHA:** `81bc3c1fe15a9c993d0996fa316d736ed7bc51f6`  
**PR #80:** MERGED (`https://github.com/ebrinejason-sys/SYNAPSE-OS/pull/80`)

**CORE OS GREEN: NO**  
**DEMO GREEN: YES**

Public Demo (`demo.synapseos.tech`) is a synthetic Test Drive. It is not production `/os/[slug]`. Healthcare Demo state stays in browser IndexedDB.

## Scoreboard

| Gate | Result |
|---|---|
| FINAL MAIN SHA | `81bc3c1fe15a9c993d0996fa316d736ed7bc51f6` |
| PR #80 | **MERGED** |
| Production DB acceptance | **PASS** (Deployment `db-acceptance` on main, run `35347838353`) |
| Required CI on main | **PASS** (run `35347838329`, including Demo Playwright) |
| Release workflow | **PASS** (run `35348550179`, SHA `81bc3c1`) |
| Core hospital Playwright | **BLOCKED** (no `SYNAPSE_E2E_BASE_URL` / synthetic tenant credentials) |
| Production broken presented links | **0** (`npm run test:routes` PASS in required CI) |
| Demo Golden Journey Playwright | **PASS** (CI + local 9/9) |
| Demo reload | **PASS** |
| Demo RBAC | **PASS** (UI + domain unit tests) |
| Demo no production writes | **PASS** |
| Demo duplicate safety | **PASS** |
| Demo presented dead ends | **0** |
| Mobile 375px | **PASS** (Playwright) |
| Light theme | **PASS** (default; live menu Light checked) |
| Dark theme | **PASS** (Playwright; live Light/Dark/System control present) |
| System theme | **PASS** |
| Reset Playground | **PASS** (Playwright; theme/tip preferences may remain) |
| Admin browser | **BLOCKED** (no synthetic admin fixture) |
| Pharmacy browser | **BLOCKED** (no synthetic pharmacy fixture) |
| `SUPABASE_DB_URL` | **OPERATOR_REQUIRED** |
| Main protected | **YES** (ruleset `Protect main` / `23649402`, enforcement active, no bypass actors) |
| OS deployed SHA | `12a46f825611efeecbf56f03b18a061259a2562c` (PR #78) |
| Demo deployed SHA | `81bc3c1fe15a9c993d0996fa316d736ed7bc51f6` |
| Pharmacy deployed SHA | `81bc3c1fe15a9c993d0996fa316d736ed7bc51f6` |
| SHA alignment | **FAIL** (OS production is not the approved main SHA) |
| Live unexplained 5xx (1h window) | **0** (Demo, OS, Pharmacy) |
| Mobile app | **BLOCKED_DEVICE** (Expo type-check + Android export PASS in CI) |
| CORE OS GREEN | **NO** |
| DEMO GREEN | **YES** |

## Tester script

1. Open Test Drive and start at Reception.
2. Move Amina through Nurse and Doctor.
3. Order/release Lab results.
4. Prescribe/dispense medication and complete Billing.
5. Open Timeline and verify Hospital → Lab → Pharmacy continuity.

## What was proven

- PR #80 was rebased onto `508b7e8`, then merged through protected main after required CI (including Demo Golden Journey Playwright) passed. No bypass.
- Test Drive landing hierarchy: primary **Start Test Drive**, Golden Journey secondary, Clinical AI below, synthetic honesty visible.
- Station picker: **Take a station**; Reception recommended; one click sets role and navigates. Live smoke: landing → `/login` → `/reception` → Amina OPD visit started → Continue as Nurse.
- Demo Git production of `81bc3c1` was canceled by `scripts/vercel-build-gate.mjs`. Demo was then promoted deliberately with Vercel CLI from that SHA and aliased to `demo.synapseos.tech`.
- Pharmacy Git production of `81bc3c1` is live (`pharm.synapseos.tech`).
- OS Git production remains skipped by the acceptance gate. Live `synapseos.tech` is still `12a46f8`. `/api/ready` and `/api/health/live` return **404** on that older deployment.

## Why CORE OS GREEN is NO

CORE OS GREEN requires production browser journey, SHA alignment, and live OS smoke of the approved SHA. Those are not true:

1. No synthetic `SYNAPSE_E2E_EMAIL` / `SYNAPSE_E2E_PASSWORD` / `SYNAPSE_E2E_BASE_URL` — hospital Playwright is **BLOCKED**, not PASS.
2. OS production SHA `12a46f8` ≠ approved main `81bc3c1`. `ENABLE_VERCEL_CLI_DEPLOY` is not set; Git production deploys for OS are skipped on purpose.
3. `SUPABASE_DB_URL` is not configured for post-apply `psql` verification.

**OPERATOR ACTION REQUIRED:** Configure `SUPABASE_DB_URL` in the production GitHub environment/secrets. Do not print the URL.

**OPERATOR ACTION REQUIRED:** After synthetic tenant credentials exist, run `scripts/e2e-hospital-browser.mjs` against a non-real facility.

**OPERATOR ACTION REQUIRED:** Promote OS production from `81bc3c1` through the gated CLI path (`ENABLE_VERCEL_CLI_DEPLOY=true` after db-acceptance), not by re-enabling Git production deploys.

## Branch cleanup

Not executed. Production hospital/admin/pharmacy browser proof is BLOCKED, so obsolete-branch deletion is deferred.

Remote branches at report time:

- `origin/main` (`81bc3c1`)
- `origin/cursor/demo-ecosystem-green-2026-09-18` (merged as PR #80; ancestor of main)
- `origin/cursor/final-green-release-2026-09-18` (merged as PR #81; ancestor of main)

## Follow-ups (do not block Demo GREEN)

- Identify the Demo Vercel project in `vercel-build-gate.mjs` by project name so Git production of `synapse-demo` is not canceled when `VERCEL_PROJECT_PRODUCTION_URL` is not `demo.synapseos.tech`.
- `apps/pharmacy/vercel.json` has no `ignoreCommand`; Pharmacy Git still deploys on push. Align with the OS acceptance gate if Pharmacy production should also be promoted deliberately.
