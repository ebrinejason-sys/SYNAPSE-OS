# Production Acceptance Setup for SYNAPSE-OS

This runbook documents the minimized security architecture for protected hospital acceptance testing against a remote Vercel deployment.

## Security Principles

1. **Minimized Secret Surface**: Each component receives only the secrets it genuinely needs
2. **Isolated Database**: Acceptance uses a dedicated Supabase project, never the production database
3. **Protected Environment**: All secrets live on the `production-acceptance` GitHub Environment, never repo-wide or in `pull_request` jobs
4. **Operator Attestation**: Remote host configuration is verified manually before acceptance proceeds
5. **Exact SHA Gate**: Acceptance runs only on the exact commit SHA the operator specifies

## Architecture Overview

### Three-Tier Configuration

#### 1. Browser Acceptance Runner (GitHub Actions)
The Playwright browser tests run on GitHub's runner and need **only** what the browser needs:

- `SYNAPSE_E2E_BASE_URL` – remote Vercel deployment URL to test against
- `SYNAPSE_E2E_EMAIL` – staff login email
- `SYNAPSE_E2E_PASSWORD` – staff login password
- `SYNAPSE_E2E_FIXED_OTP` – the 6-digit code to type into the browser UI

**Does NOT need**: JWT secrets, Supabase anon keys, or service role keys (the browser hits API routes, not the database directly)

#### 2. Seed Step (GitHub Actions)
The database seeding script runs on GitHub's runner and needs **only** database write access:

- `SYNAPSE_E2E_SUPABASE_URL` – isolated E2E Supabase project URL
- `SYNAPSE_E2E_SERVICE_ROLE_KEY` – service role key for that project
- `SYNAPSE_E2E_PASSWORD` – the password to hash and seed into staff profiles
- `SYNAPSE_E2E_SEED=true` – safety flag

**Does NOT need**: The browser's base URL or OTP (seed never logs in)

#### 3. Remote Vercel Host (Deployment Environment)
The Next.js application deployed at `SYNAPSE_E2E_BASE_URL` needs:

- `SYNAPSE_E2E_AUTH=true` – enables E2E OTP gate in production code
- `SYNAPSE_E2E_ACCEPTANCE_ENV=true` – confirms this is the acceptance environment
- `SYNAPSE_E2E_FIXED_OTP` – the same 6-digit code (server validates it matches before issuing sessions)

**Does NOT need**: Service role keys on the deployment (acceptance does not seed from the web app)

## Required Configuration

### GitHub Environment Secrets (`production-acceptance`)

All secrets must be configured on the **`production-acceptance` environment** in GitHub repository settings. Never add these as repository secrets or organization secrets where `pull_request` jobs can access them.

| Secret Name | Source | Description | Example Format |
|-------------|--------|-------------|----------------|
| `SYNAPSE_E2E_BASE_URL` | Operator (Vercel) | Remote acceptance deployment URL | `https://synapse-os-git-feature-acceptance.vercel.app` |
| `SYNAPSE_E2E_EMAIL` | Operator | E2E staff login email | `acceptance@example.com` |
| `SYNAPSE_E2E_PASSWORD` | Operator | E2E staff login password (12+ chars) | *(minimum 12 characters, bcrypt hashed during seed)* |
| `SYNAPSE_E2E_FIXED_OTP` | Operator | Fixed 6-digit OTP code | `246801` *(exactly 6 digits)* |
| `SYNAPSE_E2E_SUPABASE_URL` | Supabase Dashboard | Isolated E2E database URL | `https://xyz.supabase.co` |
| `SYNAPSE_E2E_SERVICE_ROLE_KEY` | Supabase Dashboard | Service role key for E2E database | `eyJhbGci...` *(starts with eyJ)* |
| `SYNAPSE_E2E_REMOTE_HOST_READY` | Operator Attestation | Confirms Vercel env vars are set | `true` *(exactly the string "true")* |

### Vercel Preview Environment Variables

Configure these on the **Vercel project** for the preview/branch deployment you will test:

| Variable Name | Value | Scope |
|---------------|-------|-------|
| `SYNAPSE_E2E_AUTH` | `true` | Preview (branch-specific or all previews) |
| `SYNAPSE_E2E_ACCEPTANCE_ENV` | `true` | Preview (branch-specific or all previews) |
| `SYNAPSE_E2E_FIXED_OTP` | *(same 6-digit value as GitHub secret)* | Preview |

**IMPORTANT**: These variables must be configured on the Vercel **Preview** environment scope, not Production. The code refuses to enable E2E gates when `VERCEL_ENV=production`.

### Supabase Isolated Database

Create a **dedicated Supabase project** for E2E acceptance, separate from production:

1. Create a new Supabase project (e.g., "synapse-e2e-acceptance")
2. Apply all migrations from `supabase/migrations/` to the new project
3. Copy the project URL and service role key from the Supabase dashboard
4. Add them as `SYNAPSE_E2E_SUPABASE_URL` and `SYNAPSE_E2E_SERVICE_ROLE_KEY` to the GitHub environment

**Never** reuse the production database for acceptance testing.

## Operator-Created Values

The following values are **invented by the operator** and must remain consistent across GitHub and Vercel:

### `SYNAPSE_E2E_EMAIL`
- **MUST** use a canonical E2E role email from the OTP allowlist
- The acceptance authentication gates only permit specific emails defined in `packages/auth/src/e2e-otp.ts`
- **Required value**: `reception.e2e@synapseos.invalid`
- Alternative role emails (if needed): `nurse.e2e@synapseos.invalid`, `doctor.e2e@synapseos.invalid`, etc.
- Will be seeded into the `profiles` table for login

### `SYNAPSE_E2E_PASSWORD`
- At least 12 characters
- Will be bcrypt-hashed (cost 12) during seed
- The browser tests will use this password to log in

### `SYNAPSE_E2E_FIXED_OTP`
- Exactly 6 digits (e.g., `246801`)
- Set the **identical value** on both GitHub (secret) and Vercel (env var)
- When the browser types this OTP, the server validates it matches the deployed value

## Hardcoded Non-Secret Values

The following values are **hardcoded in the codebase** and do not need to be configured:

- **Facility Slugs**: `synapse-e2e-hospital`, `synapse-e2e-hospital-b`
- **Synthetic Tenant Flags**: Set automatically by the seed script
- **Role Emails**: Defined in `packages/auth/src/e2e-otp.ts` (e.g., `reception.e2e@synapseos.invalid`)

These are committed to the repository and are not considered secrets.

## Setup Workflow

### 1. Create Isolated Supabase Project
```bash
# In Supabase dashboard
1. Create new project: "synapse-e2e-acceptance"
2. Wait for provisioning
3. Copy Project URL and Service Role Key
```

### 2. Run Migrations on E2E Database
```bash
# Locally
supabase db push --project-ref <e2e-project-ref>
```

### 3. Configure GitHub Environment Secrets
```
Repository Settings → Environments → production-acceptance → Add secret
```

Add all 7 secrets from the table above.

### 4. Configure Vercel Preview Variables
```bash
# Via Vercel dashboard
Project Settings → Environment Variables → Add variable
- SYNAPSE_E2E_AUTH = true (Preview scope)
- SYNAPSE_E2E_ACCEPTANCE_ENV = true (Preview scope)
- SYNAPSE_E2E_FIXED_OTP = 246801 (Preview scope, match GitHub secret)
```

### 5. Set Attestation Flag
Once Vercel variables are confirmed deployed:
```
GitHub → production-acceptance environment → Add secret
SYNAPSE_E2E_REMOTE_HOST_READY = true
```

### 6. Run Preflight Check Locally (Optional)
```bash
export SYNAPSE_E2E_BASE_URL="https://your-preview.vercel.app"
export SYNAPSE_E2E_EMAIL="acceptance@example.com"
export SYNAPSE_E2E_PASSWORD="your-secure-password"
export SYNAPSE_E2E_FIXED_OTP="246801"
export SYNAPSE_E2E_SUPABASE_URL="https://xyz.supabase.co"
export SYNAPSE_E2E_SERVICE_ROLE_KEY="eyJhbGci..."
export SYNAPSE_E2E_REMOTE_HOST_READY="true"

npm run e2e:acceptance:doctor
```

Expected output:
```
✅ PREFLIGHT PASSED: All required configuration is present and valid
```

### 7. Trigger Acceptance Workflow
```bash
# Via GitHub Actions UI
Actions → OS E2E Acceptance → Run workflow
- Branch: cursor/core-os-final-acceptance-2026-09-18 (or your branch)
- EXPECTED_SHA: <git SHA from the PR you want to test>
```

## Preflight Doctor Script

The `npm run e2e:acceptance:doctor` command validates configuration **before** running acceptance:

- ✅ **Does**: Check that all required variables are present and correctly formatted
- ✅ **Does**: Classify each variable by source (OPERATOR_CREATED, SUPABASE, VERCEL, ATTESTATION)
- ❌ **Does NOT**: Print secret values (only FOUND / MISSING / INVALID)
- ❌ **Does NOT**: Test database connectivity or remote host reachability (format-only validation)

Exit codes:
- `0` = All required configuration is present and valid (format checks only)
- `1` = One or more required variables are MISSING or INVALID

## Removed Unnecessary Variables

The following variables were **removed** from the browser acceptance step because they are not used by Playwright tests:

- ❌ `SYNAPSE_JWT_SECRET` / `SYNAPSE_E2E_JWT_SECRET` – not needed (browser never signs JWTs)
- ❌ `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SYNAPSE_E2E_ANON_KEY` – not needed (browser calls API routes, not Supabase directly)
- ❌ `SUPABASE_SERVICE_ROLE_KEY` on browser step – moved to seed step only (browser never writes to database)

## Troubleshooting

### Preflight Fails: `SYNAPSE_E2E_BASE_URL` is INVALID (must be remote, not localhost)
- ✅ Ensure the URL starts with `https://`
- ✅ Ensure the URL is not `localhost` or `127.0.0.1`
- ✅ Confirm the Vercel preview deployment is live

### Preflight Fails: `SYNAPSE_E2E_REMOTE_HOST_READY` is MISSING
- ✅ Add `SYNAPSE_E2E_REMOTE_HOST_READY=true` to the `production-acceptance` GitHub environment
- ✅ Confirm all three Vercel variables are deployed:
  ```bash
  vercel env ls
  # Should show SYNAPSE_E2E_AUTH, SYNAPSE_E2E_ACCEPTANCE_ENV, SYNAPSE_E2E_FIXED_OTP in Preview scope
  ```

### Browser Tests Fail: OTP Rejected
- ✅ Confirm `SYNAPSE_E2E_FIXED_OTP` is **identical** on GitHub (secret) and Vercel (env var)
- ✅ Confirm `SYNAPSE_E2E_AUTH=true` and `SYNAPSE_E2E_ACCEPTANCE_ENV=true` are on the Vercel deployment
- ✅ Confirm `VERCEL_ENV` is not `production` (E2E gates refuse to enable in production)

### Seed Fails: Database Connection Error
- ✅ Confirm `SYNAPSE_E2E_SUPABASE_URL` and `SYNAPSE_E2E_SERVICE_ROLE_KEY` are from the **isolated E2E project**, not production
- ✅ Run migrations on the E2E database: `supabase db push --project-ref <e2e-ref>`

### Browser Tests Fail: Login Rejected (Password Incorrect)
- ✅ Re-run the seed step to ensure the seeded password hash matches the current `SYNAPSE_E2E_PASSWORD`
- ✅ Confirm the seed step succeeded (check GitHub Actions logs for `"passwordHashAlgorithm": "bcrypt"`)

## Security Checklist

Before running acceptance for the first time, confirm:

- [ ] All secrets are on the `production-acceptance` **GitHub Environment**, not repo-wide secrets
- [ ] The acceptance workflow **does not** trigger on `pull_request` events
- [ ] `SYNAPSE_E2E_SUPABASE_URL` points to an **isolated E2E database**, not production
- [ ] Vercel variables are scoped to **Preview**, not Production
- [ ] `SYNAPSE_E2E_REMOTE_HOST_READY` attestation is set only **after** confirming Vercel variables are live
- [ ] No secret values are committed to the repository or visible in logs

## References

- Workflow: `.github/workflows/os-e2e-acceptance.yml`
- Seed script: `scripts/seed-e2e-os-fixture.ts`
- Playwright helpers: `e2e/os-helpers.ts`
- E2E OTP gates: `packages/auth/src/e2e-otp.ts`
- Preflight doctor: `scripts/e2e-acceptance-doctor.mjs`
- Architecture tests: `scripts/e2e-ci-architecture.test.mjs`

---

**Last Updated**: 2026-09-18 (PR #83 – minimized secret surface)
