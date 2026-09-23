# Golden Journey Wave 3 — Live Proof + Evidence Pack (NON-PROD)

**Date:** 2026-09-23  
**Repository:** ebrinejason-sys/SYNAPSE-OS  
**Scope:** Hospital golden journey operability + documentation with evidence pack on NON-PRODUCTION environments ONLY

---

## Executive Summary

This document provides a complete operator runbook for executing and documenting the SYNAPSE-OS hospital golden journey on **non-production environments only**. It inventories required configuration, explains what each test proves, and provides clear PASS/FAIL markers for evidence collection.

**CRITICAL:** This runbook does NOT apply production migrations. This runbook does NOT mutate production data. All live testing must use Preview deployments or isolated Supabase projects.

---

## Table of Contents

1. [Environment Requirements](#environment-requirements)
2. [Test Inventory](#test-inventory)
3. [Operator Checklist](#operator-checklist)
4. [Running Tests](#running-tests)
5. [Evidence Collection](#evidence-collection)
6. [CI vs Live Testing](#ci-vs-live-testing)
7. [Troubleshooting](#troubleshooting)

---

## Environment Requirements

### 1. Local Development (No Secrets Required)

The following tests run entirely in-memory with no external dependencies:

- ✅ Domain layer unit tests
- ✅ Route contract tests  
- ✅ Bridge logic tests
- ✅ Security policy tests

**Required:** Node.js 22.x, `npm ci`

### 2. Preview/Staging Environment (Isolated Supabase Required)

Live synthetic journey tests require:

**Supabase Project (NON-PROD):**
- `SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_URL` — **must NOT be production** (verified by project ref check)
- `SUPABASE_SERVICE_ROLE_KEY` — for seeding only
- **Acceptable project refs:** Any valid Supabase project EXCEPT `qfqakzmjatszisuqjwon` (production)

**Vercel Deployment (Preview):**
- `SYNAPSE_E2E_BASE_URL` — Preview deployment URL (e.g., `https://synapse-os-git-feature-xyz.vercel.app`)
- `SYNAPSE_E2E_VERCEL_BYPASS` — Protection bypass secret (if Preview has Vercel Protection enabled)

**E2E Test Credentials (Operator-Created):**
- `SYNAPSE_E2E_EMAIL` — Must be from allowlist: `reception.e2e@synapseos.invalid`, `nurse.e2e@synapseos.invalid`, `doctor.e2e@synapseos.invalid`, etc.
- `SYNAPSE_E2E_PASSWORD` — Minimum 12 characters
- `SYNAPSE_E2E_FIXED_OTP` — Exactly 6 digits (e.g., `246801`)

**Attestation:**
- `SYNAPSE_E2E_REMOTE_HOST_READY=true` — Operator confirms Vercel env vars are deployed
- `SYNAPSE_E2E_ACCEPTANCE_ENV=true` — Set on Vercel Preview environment

### 3. Production Environment

**NOT IN SCOPE FOR WAVE 3.** Production migrations are on HOLD. Do not run live journeys against production.

---

## Test Inventory

### Domain Layer Tests (No Secrets Required)

These tests run entirely in Node.js with no database or API calls:

| Test Command | File | What It Proves | Secrets Required |
|--------------|------|----------------|------------------|
| `npm run test:hospital-golden-journey` | `packages/db/src/hospital-golden-journey.test.ts` | Reception → triage → write-up → sign → prescribe → verify → dispense → closeout domain logic | ❌ None |
| `npm run test:hospital-closeout-golden` | `packages/db/src/hospital-closeout-golden.test.ts` | Encounter close gate: billing blocks, disposition required, signed immutability | ❌ None |
| `npm run test:opd-dispense-golden` | `packages/db/src/opd-dispense-golden.test.ts` | Prescription bridge: verify-required, dispense permission, stock decrement | ❌ None |
| `npm run test:lab-golden-journey` | `packages/db/src/lab-golden-journey.test.ts` | Lab state machine: order → collect → analyze → verify → release | ❌ None |
| `npm run test:ehr-continuity-golden` | `packages/db/src/ehr-continuity-golden.test.ts` | Patient timeline projection, event correlation | ❌ None |
| `npm run test:inpatient-lifecycle` | `packages/db/src/inpatient-lifecycle.test.ts` | Admit → transfer → discharge domain flow | ❌ None |
| `npm run test:referral-lifecycle` | `packages/db/src/referral-lifecycle.test.ts` | Referral send → accept → complete flow | ❌ None |

**Expected Output:** All tests PASS with `✓` markers. Any `✗` indicates a domain logic regression.

### Route Contract Tests (No Secrets Required)

HTTP route unit tests using mocked Supabase:

| Test Command | Files | What It Proves | Secrets Required |
|--------------|-------|----------------|------------------|
| `npm run test:control-plane` | Multiple route tests | Tenant isolation, API authorization, RLS enforcement | ❌ None |
| `npm run test:tenancy` | Tenant routing, billing APIs | Multi-tenant security boundaries | ❌ None |
| `npm run test:lab-actions` | Lab API routes | Lab order → result HTTP contract | ❌ None |

**Expected Output:** Vitest passes with all tests green.

### Configuration Doctor (Preview Environment)

Validates Preview deployment configuration WITHOUT running journeys:

| Test Command | File | What It Proves | Secrets Required |
|--------------|------|----------------|------------------|
| `npm run e2e:acceptance:doctor` | `scripts/e2e-acceptance-doctor.mjs` | All required env vars present, formatted correctly, isolated from production | ✅ Preview secrets |

**Expected Output:**

```
✓ SYNAPSE_E2E_BASE_URL           | FOUND    | VERCEL           | Remote acceptance deployment URL
✓ SYNAPSE_E2E_EMAIL              | FOUND    | OPERATOR_CREATED | E2E staff email credential
✓ SYNAPSE_E2E_PASSWORD           | FOUND    | OPERATOR_CREATED | E2E staff password
✓ SYNAPSE_E2E_FIXED_OTP          | FOUND    | OPERATOR_CREATED | Fixed 6-digit OTP
✓ SYNAPSE_E2E_SUPABASE_URL       | FOUND    | SUPABASE         | Isolated E2E database URL
✓ SYNAPSE_E2E_SERVICE_ROLE_KEY   | FOUND    | SUPABASE         | Service role key
✓ SYNAPSE_E2E_REMOTE_HOST_READY  | FOUND    | ATTESTATION      | Operator attestation

✓ /api/health/live              | FOUND    | LIVE        | Isolated Preview health
✓ /api/ready                    | FOUND    | READY       | sha=abc1234
✓ isolated project              | FOUND    | jbojujxpyxsdiukmrwzs | not production

✅ PREFLIGHT PASSED: Isolated acceptance configuration and live probes are valid
```

Any `✗` or `MISSING` / `INVALID` markers mean configuration is incomplete.

### Live Synthetic Journey (Preview Environment)

End-to-end synthetic data test against non-prod Supabase:

| Test Command | File | What It Proves | Secrets Required |
|--------------|------|----------------|------------------|
| `npm run journey:hospital-golden-live` | `scripts/hospital-golden-live-journey.mjs` | Full OPD → pharmacy flow with stock decrement, disposition, signed closeout on real database | ✅ Preview secrets |

**Expected Output:**

```json
{
  "generatedAt": "2026-09-23T10:00:00.000Z",
  "journey": "opd-prescribe-dispense-live-synthetic",
  "ok": true,
  "steps": [
    { "name": "select_tenants", "ok": true },
    { "name": "create_profiles", "ok": true },
    { "name": "create_encounter_with_writeup", "ok": true },
    { "name": "seed_stock", "ok": true },
    { "name": "place_prescription", "ok": true },
    { "name": "dispense_and_assert", "ok": true },
    { "name": "record_disposition", "ok": true },
    { "name": "sign_encounter", "ok": true },
    { "name": "closeout_assert", "ok": true },
    { "name": "cleanup", "ok": true }
  ],
  "checks": {
    "verifyRequiredBeforeDispense": true,
    "prescriptionDispensed": true,
    "stockDecrementedExactlyOnce": true,
    "idempotentSaleNoDoubleDecrement": true,
    "writeupPersisted": true,
    "signed": true,
    "dispositionLocalPharmacy": true,
    "statusCompleted": true
  }
}
```

Evidence file written to: `docs/engineering/evidence/hospital-golden-live-<timestamp>.json`

### Browser E2E Tests (Preview Environment)

Playwright browser automation against deployed Preview:

| Test Command | File | What It Proves | Secrets Required |
|--------------|------|----------------|------------------|
| `npm run test:e2e:hospital` | `e2e/hospital-golden.spec.ts` | Browser-driven OPD journey with UI interactions | ✅ Preview secrets |
| `npm run test:e2e:hospital:smoke` | `scripts/e2e-hospital-browser.mjs` | Quick smoke test of hospital portal | ✅ Preview secrets |

**Expected Output:** Playwright reports all tests passed. Screenshots/videos saved to `test-results/`.

---

## Operator Checklist

### Phase 1: Local Unit Tests (No Setup Required)

- [ ] Clone repository
- [ ] Run `npm ci`
- [ ] Run `npm run test:hospital-golden-journey`
- [ ] Run `npm run test:hospital-closeout-golden`
- [ ] Run `npm run test:opd-dispense-golden`
- [ ] Run `npm run test:lab-golden-journey`
- [ ] Verify all tests PASS (exit code 0)
- [ ] Document any failures

**Expected Time:** 5 minutes  
**Evidence:** Terminal output showing `✓` for all test suites

### Phase 2: Preview Environment Setup

- [ ] Create isolated Supabase project (not production)
  - [ ] Project name: `synapse-e2e-acceptance` or similar
  - [ ] Record project ref (e.g., `jbojujxpyxsdiukmrwzs`)
  - [ ] Verify ref is NOT `qfqakzmjatszisuqjwon` (production)
- [ ] Apply migrations to isolated project:
  ```bash
  supabase link --project-ref <e2e-project-ref>
  supabase db push
  ```
- [ ] Deploy feature branch to Vercel Preview
  - [ ] Record Preview URL (e.g., `https://synapse-os-git-feature-wave3.vercel.app`)
- [ ] Configure Vercel Preview environment variables:
  - [ ] `SYNAPSE_E2E_AUTH=true`
  - [ ] `SYNAPSE_E2E_ACCEPTANCE_ENV=true`
  - [ ] `SYNAPSE_E2E_FIXED_OTP=246801` (or your chosen 6-digit code)
- [ ] Create GitHub environment secrets (`production-acceptance` environment):
  - [ ] `SYNAPSE_E2E_BASE_URL` → Preview URL
  - [ ] `SYNAPSE_E2E_EMAIL` → `reception.e2e@synapseos.invalid`
  - [ ] `SYNAPSE_E2E_PASSWORD` → (12+ character password)
  - [ ] `SYNAPSE_E2E_FIXED_OTP` → `246801` (match Vercel)
  - [ ] `SYNAPSE_E2E_SUPABASE_URL` → Isolated project URL
  - [ ] `SYNAPSE_E2E_SERVICE_ROLE_KEY` → Service role key from Supabase
  - [ ] `SYNAPSE_E2E_VERCEL_BYPASS` → Bypass secret (if Preview protected)
  - [ ] `SYNAPSE_E2E_REMOTE_HOST_READY=true`

**Expected Time:** 15-30 minutes  
**Evidence:** Supabase dashboard showing project, Vercel deployment log showing Preview URL

### Phase 3: Configuration Validation

Export secrets locally and run doctor:

```bash
export SYNAPSE_E2E_BASE_URL="https://your-preview.vercel.app"
export SYNAPSE_E2E_EMAIL="reception.e2e@synapseos.invalid"
export SYNAPSE_E2E_PASSWORD="your-password-here"
export SYNAPSE_E2E_FIXED_OTP="246801"
export SYNAPSE_E2E_SUPABASE_URL="https://xyz.supabase.co"
export SYNAPSE_E2E_SERVICE_ROLE_KEY="eyJhbGci..."
export SYNAPSE_E2E_REMOTE_HOST_READY="true"

npm run e2e:acceptance:doctor
```

- [ ] Doctor reports `✅ PREFLIGHT PASSED`
- [ ] All variables show `FOUND` status
- [ ] Supabase project ref is NOT production
- [ ] `/api/health/live` returns 200
- [ ] `/api/ready` returns 200 with correct SHA

**Expected Time:** 2 minutes  
**Evidence:** Terminal output from doctor script showing all green checks

### Phase 4: Live Journey Execution

With environment variables still exported:

```bash
npm run journey:hospital-golden-live
```

- [ ] Script completes with exit code 0
- [ ] Evidence JSON written to `docs/engineering/evidence/hospital-golden-live-<timestamp>.json`
- [ ] Open evidence JSON and verify:
  - [ ] `"ok": true`
  - [ ] All `steps[].ok` are `true`
  - [ ] All `checks` values are `true`
  - [ ] `stockDecrementedExactlyOnce: true`
  - [ ] `idempotentSaleNoDoubleDecrement: true`
  - [ ] `writeupPersisted: true`
  - [ ] `signed: true`
  - [ ] `dispositionLocalPharmacy: true`

**Expected Time:** 5-10 seconds  
**Evidence:** JSON file showing all checks passed

### Phase 5: Browser E2E (Optional)

If Playwright is set up:

```bash
npm run test:e2e:hospital:smoke
```

- [ ] Playwright launches browser
- [ ] Browser navigates to Preview URL
- [ ] Tests complete successfully
- [ ] Screenshots saved to `test-results/`

**Expected Time:** 2-5 minutes  
**Evidence:** Playwright HTML report + screenshots

### Phase 6: Evidence Pack Assembly

Collect all evidence files:

```bash
mkdir -p evidence-pack-wave3-$(date +%Y%m%d)
cp docs/engineering/evidence/hospital-golden-live-*.json evidence-pack-wave3-*/
cp docs/evidence/GOLDEN_JOURNEY_WAVE3.md evidence-pack-wave3-*/
# Add any Playwright reports
cp -r test-results evidence-pack-wave3-*/ 2>/dev/null || true
```

- [ ] Evidence pack directory created
- [ ] JSON evidence files included
- [ ] Runbook included
- [ ] Optional: screenshots/videos included

**Evidence:** Dated directory with all artifacts

---

## Running Tests

### Quick Reference

| Environment | Command | Secrets Required | Duration |
|-------------|---------|------------------|----------|
| Local | `npm run test:hospital-golden-journey` | ❌ None | ~1s |
| Local | `npm run test:hospital-closeout-golden` | ❌ None | ~1s |
| Local | `npm run test:opd-dispense-golden` | ❌ None | ~1s |
| Local | `npm run test:lab-golden-journey` | ❌ None | ~1s |
| Preview | `npm run e2e:acceptance:doctor` | ✅ All | ~5s |
| Preview | `npm run journey:hospital-golden-live` | ✅ All | ~10s |
| Preview | `npm run test:e2e:hospital:smoke` | ✅ All | ~60s |

### Batch Execution

Run all local unit tests:

```bash
npm run test:hospital-golden-journey && \
npm run test:hospital-closeout-golden && \
npm run test:opd-dispense-golden && \
npm run test:lab-golden-journey && \
npm run test:ehr-continuity-golden && \
npm run test:inpatient-lifecycle && \
npm run test:referral-lifecycle
```

Run full Preview validation:

```bash
npm run e2e:acceptance:doctor && \
npm run journey:hospital-golden-live
```

---

## Evidence Collection

### Evidence File Locations

| Evidence Type | Path | Format |
|---------------|------|--------|
| Live journey results | `docs/engineering/evidence/hospital-golden-live-<timestamp>.json` | JSON |
| Unit test output | Terminal stdout | Text |
| Browser screenshots | `test-results/` | PNG |
| Doctor validation | Terminal stdout | Text |
| CI artifacts | GitHub Actions artifacts | ZIP |

### Evidence JSON Schema

Live journey evidence files contain:

```typescript
{
  generatedAt: string          // ISO timestamp
  supabaseProjectId: string    // Project ref (never production)
  journey: string              // Journey identifier
  hospitalSlug: string         // Tenant slug
  pharmacySlug: string         // Pharmacy tenant slug
  steps: Array<{
    name: string
    at: string                 // ISO timestamp
    ok: boolean
    [key: string]: any         // Step-specific data
  }>
  checks: {
    verifyRequiredBeforeDispense: boolean
    prescriptionDispensed: boolean
    stockDecrementedExactlyOnce: boolean
    idempotentSaleNoDoubleDecrement: boolean
    remainingStockMatchesBridge: boolean
    writeupPersisted: boolean
    signed: boolean
    dispositionLocalPharmacy: boolean
    statusCompleted: boolean
    [key: string]: boolean
  }
  ok: boolean                  // Overall result
  error?: string               // Only present if ok=false
}
```

### PASS/FAIL Markers

**PASS Indicators:**
- Domain tests: `✓` in terminal output, exit code 0
- Doctor: `✅ PREFLIGHT PASSED`
- Live journey: `"ok": true` in JSON, exit code 0
- All checks: `true` in `checks` object
- Browser: Playwright report shows all green

**FAIL Indicators:**
- Domain tests: `✗` in terminal output, exit code non-zero
- Doctor: `❌ PREFLIGHT FAILED`, any `MISSING` or `INVALID` status
- Live journey: `"ok": false` in JSON, exit code 1
- Any check: `false` in `checks` object
- Browser: Playwright report shows failures

---

## CI vs Live Testing

### What Runs in CI (GitHub Actions)

The CI workflow (`.github/workflows/ci.yml`) runs:

- ✅ All domain unit tests (`test:hospital-golden-journey`, etc.)
- ✅ All route contract tests
- ✅ Security policy tests
- ✅ Migration integrity checks
- ✅ Lint and type-check

**Does NOT run in CI:**
- ❌ Live Preview journeys (no Supabase secrets in `pull_request` context)
- ❌ Browser E2E tests (no deployment URL)
- ❌ Configuration doctor against live environment

### What Requires Live Preview

The following tests MUST run against a deployed Preview environment:

- ✅ `npm run e2e:acceptance:doctor`
- ✅ `npm run journey:hospital-golden-live`
- ✅ `npm run test:e2e:hospital`
- ✅ `npm run test:e2e:hospital:smoke`

These can be run:
1. Manually by operators (following this runbook)
2. In GitHub Actions with `production-acceptance` environment (requires manual trigger)
3. Never in `pull_request` jobs (secrets unavailable)

### CI Evidence

CI produces:
- Test output logs
- Build artifacts
- Coverage reports (if configured)

Evidence files in `docs/engineering/evidence/` are NOT auto-generated by CI. They are created by manual operator runs or scheduled acceptance workflows.

---

## Troubleshooting

### Doctor Fails: Production Detected

**Symptom:**
```
✗ SYNAPSE_E2E_SUPABASE_URL | INVALID | Refuses production SYNAPSE_OS project
```

**Cause:** `SUPABASE_URL` or `SERVICE_ROLE_KEY` points to production project `qfqakzmjatszisuqjwon`

**Fix:**
1. Create a NEW isolated Supabase project
2. Apply migrations: `supabase db push --project-ref <new-ref>`
3. Update environment variables to use new project URL and service key
4. Re-run doctor

### Doctor Fails: Base URL is Localhost

**Symptom:**
```
✗ SYNAPSE_E2E_BASE_URL | INVALID | Must be remote, not localhost
```

**Cause:** `BASE_URL` is set to `http://localhost:3000`

**Fix:**
1. Deploy branch to Vercel Preview
2. Copy Preview URL from Vercel dashboard
3. Set `SYNAPSE_E2E_BASE_URL` to Preview URL
4. Re-run doctor

### Doctor Fails: OTP Format Invalid

**Symptom:**
```
✗ SYNAPSE_E2E_FIXED_OTP | INVALID | Must be exactly 6 digits
```

**Cause:** OTP is not a 6-digit number

**Fix:**
1. Generate a new 6-digit code (e.g., `246801`)
2. Update both GitHub secret AND Vercel Preview env var to match
3. Redeploy Preview to pick up new env var
4. Re-run doctor

### Doctor Fails: Email Not in Allowlist

**Symptom:**
```
✗ SYNAPSE_E2E_EMAIL | INVALID | Must be a synthetic @synapseos.invalid E2E identity
```

**Cause:** Email is not from E2E allowlist

**Fix:**
1. Set `SYNAPSE_E2E_EMAIL` to one of:
   - `reception.e2e@synapseos.invalid`
   - `nurse.e2e@synapseos.invalid`
   - `doctor.e2e@synapseos.invalid`
   - `pharmacist.e2e@synapseos.invalid`
   - `lab.e2e@synapseos.invalid`
   - `admin.e2e@synapseos.invalid`
2. Re-run doctor

**See:** `packages/auth/src/e2e-otp.ts` for full allowlist

### Live Journey Fails: Tenant Not Found

**Symptom:**
```json
{
  "ok": false,
  "error": "hospital tenant missing: synthetic-hospital-20260903"
}
```

**Cause:** Required synthetic tenants not seeded in database

**Fix:**
1. Run hospital seed (if script exists):
   ```bash
   npm run seed:hospital-synthetic
   ```
2. OR manually create tenant rows in Supabase dashboard:
   - Tenant slug: `synthetic-hospital-20260903`
   - Tenant slug: `pharm-synapse-pilot`
3. Re-run journey

### Live Journey Fails: Stock Decrement Mismatch

**Symptom:**
```json
{
  "ok": false,
  "checks": {
    "stockDecrementedExactlyOnce": false
  }
}
```

**Cause:** Idempotency key collision or FEFO logic regression

**Fix:**
1. Check for duplicate runs with same idempotency key
2. Review `complete_pharmacy_sale` RPC changes
3. Review `pharmacy_sale_idempotency` table constraints
4. Run domain unit tests to isolate issue:
   ```bash
   npm run test:opd-dispense-golden
   ```

### Live Journey Fails: Permission Denied

**Symptom:**
```json
{
  "ok": false,
  "error": "DISPENSE_PERMISSION_DENIED"
}
```

**Cause:** RLS policies blocking synthetic user

**Fix:**
1. Verify service role key is correct (bypasses RLS)
2. Check if profiles exist with correct roles
3. Review `verifyPrescription` / `dispensePrescription` role checks
4. Run domain unit tests:
   ```bash
   npm run test:opd-dispense-golden
   ```

### Browser E2E Fails: Login Rejected

**Symptom:** Playwright screenshot shows "Invalid credentials" error

**Cause:** Password mismatch between seed and test

**Fix:**
1. Verify `SYNAPSE_E2E_PASSWORD` matches seeded password
2. Re-run seed script if password changed
3. Check that email is in allowlist
4. Verify OTP matches between GitHub and Vercel

### Browser E2E Fails: OTP Invalid

**Symptom:** Playwright screenshot shows "Invalid OTP" error

**Cause:** OTP mismatch between GitHub secret and Vercel env var

**Fix:**
1. Verify `SYNAPSE_E2E_FIXED_OTP` matches on:
   - GitHub environment secret
   - Vercel Preview environment variable
2. Redeploy Preview to pick up env var change
3. Re-run doctor to verify: `npm run e2e:acceptance:doctor`
4. Re-run browser tests

### CI Tests Pass but Live Journey Fails

**Cause:** Domain logic is correct but database state, migrations, or API implementation has diverged

**Fix:**
1. Verify migrations are applied to Preview database:
   ```bash
   supabase db push --project-ref <preview-ref>
   ```
2. Check API route implementations match domain contracts
3. Review RLS policies for unintended blocks
4. Compare `packages/db/src/` domain code with `apps/web/src/app/api/` route handlers
5. Add route contract tests for failing paths

---

## Next Steps After Wave 3

### Wave 4 (Future)

- [ ] Production migration apply (requires stakeholder approval)
- [ ] Merge Wave 2 auth PR
- [ ] Production seed with real hospital data
- [ ] Live acceptance against production Preview (same isolation model)

### Documentation Updates

- [ ] Update `docs/runbooks/PRODUCTION_ACCEPTANCE_SETUP.md` with any environment changes
- [ ] Add Wave 3 evidence to `docs/HOSPITAL_ACCEPTANCE_RESULTS.md`
- [ ] Update `docs/PROJECT_GOLDEN_2026.md` with live proof status

### Continuous Improvement

- [ ] Add more golden journeys (surgery, maternity, etc.)
- [ ] Automate evidence collection in scheduled CI job
- [ ] Create dashboard for acceptance status
- [ ] Add performance benchmarks to evidence pack

---

## Appendix: Environment Variable Reference

### Complete Environment Variable List

| Variable | Required For | Format | Example | Production-Safe |
|----------|--------------|--------|---------|-----------------|
| `SYNAPSE_E2E_BASE_URL` | Preview tests | URL | `https://preview.vercel.app` | ❌ No |
| `SYNAPSE_E2E_EMAIL` | Preview tests | Email from allowlist | `reception.e2e@synapseos.invalid` | ❌ No |
| `SYNAPSE_E2E_PASSWORD` | Preview tests | String 12+ chars | `SecurePass123!` | ❌ No |
| `SYNAPSE_E2E_FIXED_OTP` | Preview tests | 6 digits | `246801` | ❌ No |
| `SYNAPSE_E2E_SUPABASE_URL` | Preview tests | Supabase URL | `https://xyz.supabase.co` | ❌ No (must be isolated) |
| `SYNAPSE_E2E_SERVICE_ROLE_KEY` | Preview tests | JWT | `eyJhbGci...` | ❌ No (must be isolated) |
| `SYNAPSE_E2E_VERCEL_BYPASS` | Preview tests (optional) | Secret string | `random-secret-123` | ❌ No |
| `SYNAPSE_E2E_REMOTE_HOST_READY` | Preview tests | Literal `"true"` | `true` | ❌ No |
| `SYNAPSE_E2E_ACCEPTANCE_ENV` | Vercel Preview | Literal `"true"` | `true` | ❌ No |
| `SYNAPSE_E2E_AUTH` | Vercel Preview | Literal `"true"` | `true` | ❌ No |
| `SUPABASE_URL` | Local/CLI | Supabase URL | `https://xyz.supabase.co` | ⚠️ Use with care |
| `SUPABASE_SERVICE_ROLE_KEY` | Local/CLI | JWT | `eyJhbGci...` | ⚠️ Use with care |
| `EXPECTED_SHA` | CI validation | Git SHA | `abc123def456...` | ✅ Yes |
| `GITHUB_SHA` | CI validation | Git SHA | `abc123def456...` | ✅ Yes |

### Allowlisted E2E Emails

From `packages/auth/src/e2e-otp.ts`:

- `reception.e2e@synapseos.invalid`
- `nurse.e2e@synapseos.invalid`
- `doctor.e2e@synapseos.invalid`
- `pharmacist.e2e@synapseos.invalid`
- `lab.e2e@synapseos.invalid`
- `admin.e2e@synapseos.invalid`
- `radiologist.e2e@synapseos.invalid`
- `accountant.e2e@synapseos.invalid`

**Note:** These are synthetic identities for testing. They will never receive real email.

---

## Document History

| Date | Version | Changes |
|------|---------|---------|
| 2026-09-23 | 1.0 | Initial Wave 3 runbook |

---

**End of Runbook**
