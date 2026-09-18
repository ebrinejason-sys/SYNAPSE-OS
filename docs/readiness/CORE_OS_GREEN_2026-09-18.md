# Core OS Green — 2026-09-18

**Status:** CURRENT  
**Branch:** `cursor/core-os-final-acceptance-2026-09-18`  
**Approved main at branch creation:** `81bc3c1fe15a9c993d0996fa316d736ed7bc51f6`

**CORE OS GREEN: NO**

Demo GREEN is unchanged. This campaign does not reopen Demo work.

## Scoreboard

| Gate | Result |
|---|---|
| DB acceptance | **PASS** (main `35347838353`) |
| Required CI | **PASS** on `81bc3c1`; this branch pending |
| Production Golden Journey | **BLOCKED** (no `SYNAPSE_E2E_*` credentials in this environment) |
| Same person / encounter continuity | **BLOCKED** (awaits browser journey) |
| Tenant isolation | **PASS** domain (`isTenantScopeAllowed`); browser **BLOCKED** |
| Role enforcement | **PASS** domain capability guards; browser API **BLOCKED** |
| Signed record safety | **PASS** domain + sync apply tests |
| Lab | **PASS** domain goldens; browser **BLOCKED** |
| Pharmacy | **PASS** domain + live synthetic DB journey script exists; browser **BLOCKED** |
| Billing | **PASS** domain close-gate / payment tests; browser **BLOCKED** |
| Admin | **BLOCKED** |
| `/api/health/live` `/api/ready` | **FAIL** on live `synapseos.tech` (404 — OS deploy SHA is still `12a46f8`) |
| `SUPABASE_DB_URL` | **OPERATOR_REQUIRED** |
| Release workflow | **FIXED** on this branch (PR CI no longer fails Release); not yet on main |
| SHA alignment | **FAIL** (OS `12a46f8` ≠ main `81bc3c1`) |
| Live unexplained 5xx (prior window) | **0** |
| Production broken links | **0** |
| FHIR / ICD11 / AI | **PASS / DEGRADED / DEGRADED** (contract tests; optional integrations) |
| Mobile | **BLOCKED_DEVICE** |
| CORE OS GREEN | **NO** |

## Fixture

Identified existing synthetic hospital `synapse-acceptance-hospital-two` (staffed). This campaign adds an idempotent seed:

```bash
SYNAPSE_E2E_SEED=true SYNAPSE_E2E_PASSWORD='…' npm run seed:e2e-os
```

Creates:

- `synapse-e2e-hospital`
- `synapse-e2e-hospital-b`
- role users `e2e.<role>.a@synapseos.invalid`
- canonical person **Amina E2E** + Synapse ID + patient row

Password is never printed. Operator must store it in GitHub secrets:

- `SYNAPSE_E2E_EMAIL`
- `SYNAPSE_E2E_PASSWORD`
- `SYNAPSE_E2E_FACILITY_SLUG=synapse-e2e-hospital`
- `SYNAPSE_E2E_BASE_URL` (preview of this SHA, not the drifted production OS)

Production login requires OTP. Synthetic tenants skip Resend delivery; Playwright plants a hashed OTP via service role.

## Promotion

Do not promote OS until the hospital Playwright Golden Journey **PASS**es. Git production deploys remain skipped on purpose.

## Operator actions

1. Configure `SUPABASE_DB_URL` in the production GitHub environment. Do not print it.
2. Run `npm run seed:e2e-os` with `SYNAPSE_E2E_SEED=true`.
3. Set `SYNAPSE_E2E_*` GitHub secrets.
4. Re-run required CI and the hospital Playwright job.
5. Promote OS from the approved SHA through `ENABLE_VERCEL_CLI_DEPLOY` after db-acceptance.
