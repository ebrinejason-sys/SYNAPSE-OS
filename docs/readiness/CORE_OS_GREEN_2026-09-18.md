# Core OS Green — 2026-09-18

**Status:** CURRENT  
**Branch:** `cursor/core-os-final-acceptance-2026-09-18`  
**Historical main at branch creation:** `81bc3c1fe15a9c993d0996fa316d736ed7bc51f6`  
**Current origin/main:** `711796cf99fe666554335588a82a566f65e94bc4`

**CORE OS GREEN: NO**

Antigravity's pre-seed report is not accepted as evidence. Isolated ref `jbojujxpyxsdiukmrwzs` is **not** visible to the authenticated Supabase org (`3brine`). It is not a proven isolated acceptance database. Do not seed it. Do not point Preview at it.

Preferred next isolated target: a temporary Supabase development branch of `SYNAPSE_OS` (`qfqakzmjatszisuqjwon`, `eu-west-1`). Branch creation is billable (~$0.01344/hour) and requires explicit operator approval.

## Security hardening (PR #83)

**Historical security SHA:** `19145a7`  
**CORE OS GREEN:** NO

- Pull request CI does not receive `SUPABASE_SERVICE_ROLE_KEY` or E2E OTP secrets
- Privileged Hospital Golden Journey is gated behind `.github/workflows/os-e2e-acceptance.yml` + `production-acceptance` environment + exact `EXPECTED_SHA`
- E2E OTP uses protected `SYNAPSE_E2E_FIXED_OTP` (no planted OTP race, no hardcoded reusable code)
- Seed passwords use production bcrypt cost 12; fail-closed synthetic slugs only
- Login success requires authenticated `/os/{slug}` (rejects `/login?next=` false positives)
- Smoke is unauthenticated surface-only
- Remote Playwright does not start a local webServer when `PLAYWRIGHT_BASE_URL` / `SYNAPSE_E2E_BASE_URL` is set
- Fixed OTP and skipped OTP email now require the same six gates. An allowlisted email alone cannot suppress Resend. Receptionist identity is `reception.e2e@synapseos.invalid`, not a live Gmail address.

Seed, Golden Journey, merge, and production promotion remain **NOT RUN**.

Demo GREEN is unchanged. This campaign does not reopen Demo work.

## Scoreboard

| Gate | Result |
|---|---|
| DB acceptance | **PASS** on historical main evidence; not re-run on this SHA |
| Required CI | **PASS** on `afa6ddb`; new OTP fail-closed SHA pending |
| Production Golden Journey | **NOT_RUN** |
| Same person / encounter continuity | **NOT_RUN** |
| Tenant isolation | **PASS** domain; browser **NOT_RUN** |
| Role enforcement | **PASS** domain capability guards; browser **NOT_RUN** |
| Signed record safety | **PASS** domain + sync apply tests |
| Lab | **PASS** domain goldens; browser **NOT_RUN** |
| Pharmacy | **PASS** domain; browser **NOT_RUN** |
| Billing | **PASS** domain; browser **NOT_RUN** |
| Admin | **BLOCKED** |
| `/api/health/live` `/api/ready` | **FAIL** on live `synapseos.tech` (404 after www redirect) |
| Isolated acceptance DB provenance | **FAIL** (`jbojujxpyxsdiukmrwzs` unproven) |
| Remote migrations on acceptance DB | **FAIL** (not applied / not inspectable) |
| Preview DB match | **UNKNOWN** (preview SSO-protected; isolated DB unproven) |
| `SUPABASE_DB_URL` | **OPERATOR_REQUIRED** |
| Release workflow | **FIXED** on this branch (PR CI no longer fails Release) |
| SHA alignment | **FAIL** (live OS still not current `origin/main`) |
| Live unexplained 5xx (prior window) | **0** |
| Production broken links | **0** |
| FHIR / ICD11 / AI | **PASS / DEGRADED / DEGRADED** |
| Mobile | **BLOCKED_DEVICE** |
| CORE OS GREEN | **NO** |

## Security architecture

Pull request CI no longer receives `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`, or E2E auth secrets.

Privileged Hospital Golden Journey runs only from:

```text
.github/workflows/os-e2e-acceptance.yml
```

via `workflow_dispatch` / `workflow_call` against an exact reviewed SHA, using the protected GitHub Environment `production-acceptance`.

E2E OTP is server-generated. Playwright never plants OTP rows and never hardcodes a reusable code. `SYNAPSE_E2E_FIXED_OTP` is used only when all of these are true:

- `SYNAPSE_E2E_AUTH=true`
- `SYNAPSE_E2E_ACCEPTANCE_ENV=true`
- `VERCEL_ENV` is not `production`
- tenant is synthetic
- facility slug is `synapse-e2e-hospital` or `synapse-e2e-hospital-b`
- email is on the explicit synthetic E2E allowlist (`*.e2e@synapseos.invalid`)
- email skip/Resend bypass uses the same six gates as fixed OTP (an allowlisted address alone is not enough)

Production users keep random OTP + existing rate limits.

## Fixture

Do not seed until this PR's security architecture is on a reviewed SHA.

```bash
SYNAPSE_E2E_SEED=true \
SYNAPSE_E2E_SUPABASE_URL='…' \
SYNAPSE_E2E_SERVICE_ROLE_KEY='…' \
SYNAPSE_E2E_PASSWORD='…' \
npm run seed:e2e-os
```

Creates only:

- `synapse-e2e-hospital`
- `synapse-e2e-hospital-b`
- role users `reception.e2e@synapseos.invalid` … `admin.e2e@synapseos.invalid`
- canonical person **Amina E2E** exactly once

Password hashing uses production `hashPassword` (bcrypt cost 12). The password is never printed.

## Operator actions after this PR is security-green

Configure the protected environment `production-acceptance` only. Do not put these on untrusted pull_request jobs:

- `SYNAPSE_E2E_EMAIL`
- `SYNAPSE_E2E_PASSWORD`
- `SYNAPSE_E2E_FACILITY_SLUG=synapse-e2e-hospital`
- `SYNAPSE_E2E_BASE_URL` (preview of the reviewed SHA, not drifted production OS)
- `SYNAPSE_E2E_FIXED_OTP`
- `SYNAPSE_E2E_SUPABASE_URL`
- `SYNAPSE_E2E_SERVICE_ROLE_KEY`

`SUPABASE_DB_URL` belongs in the protected production GitHub environment, never in PR CI.

## Promotion

Do not promote OS until the protected Hospital Playwright Golden Journey **PASS**es. Git production deploys remain skipped on purpose.
