# RC1 release gate snapshot — `120d176` (2026-09-13)

Branch: `feat/rc1-lab-offline-acceptance` (local; **no push** / production untouched)

## Gate checklist

| Check | Result |
|-------|--------|
| Merge `main` into feat | Done (`82153e7` merge commit earlier) |
| Lab verify/release/amend durable audit | Done (`19a7944`) |
| HTTP+DB failure matrix | **12/12 PASS** reaffirmed at `120d176` (`npx tsx scripts/rc1-failure-matrix.mjs`) |
| Verify-capable disposable schema | Expanded; pharmacy ints **3/3 PASS** (dispense, billing, malaria) |
| Billing payment idempotency | **Fixed** — idempotency before `INVOICE_ALREADY_PAID` (`120d176`) |
| `test:lab-actions` | 8/8 PASS |
| `test:hospital-sync-apply` | 12/12 PASS |
| clinical-offline writeup / prescribe node tests | PASS |
| `apps/web` `type-check` (`tsc --noEmit`) | PASS |
| `apps/web` production `build` | PASS |
| Full `npm run verify` | **Not claimed green** — historical env coupling; use scoped suites + disposable evidence |
| Facility-switch browser E2E | **Open / deferred** — API tenant scope denial covered (403 in failure matrix); no second-facility session cookie harness yet |
| LIVE_PROOF / production deploy | **Out of scope** for this gate |

## Merge-ready judgment

**Close enough for review-ready PR** on lab/offline acceptance + audit/retry + failure matrix, **with explicit deferred gaps**:

1. Facility-switch **browser** E2E (tracked)
2. Full empty-DB migration replay (documented; not required for disposable RC1)
3. Full monorepo `npm run verify` vs production Supabase (do not point disposable `.env.local` at prod)

Recommended next human step: push branch + open PR for review (still no production DB/migrate/deploy from this gate).
