# Production release gate

**Status:** CURRENT  
**Date:** 2026-09-18

Production promotion is **not** “Vercel Git deployed, verify later”.

## Required order

1. Pull request against `main`
2. Required CI (`.github/workflows/ci.yml` job `required`)
3. Merge
4. Database/schema acceptance (`.github/workflows/db-production.yml` dry-run + operator `RECONCILED` attestation; `deploy.yml` `db-acceptance` on `main`)
5. Deployment approval / promotion (GitHub Actions CLI deploy with `ENABLE_VERCEL_CLI_DEPLOY=true`, after db-acceptance)
6. Live synthetic smoke (`npm run health:smoke`, `/api/ready`, hospital/lab goldens as credentials allow)
7. Mark release GREEN only from `artifacts/readiness/PRODUCTION_GREEN_REPORT.json`

## Vercel Git production

Root `vercel.json` `ignoreCommand` now **skips Git production builds** (`VERCEL_ENV=production`). Preview deployments continue.

This prevents the historical “Git push to main deploys independently of database acceptance” path.

To temporarily restore Git production deploys (incident only), set `ALLOW_VERCEL_GIT_PRODUCTION=true` in the Vercel project env **and** change `scripts/vercel-build-gate.mjs` — do not do this as the normal path.

## SHA alignment

Platform Admin production truth must show:

- GitHub `main` SHA
- Approved release SHA
- Vercel production SHA
- Repo migration head
- Remote migration ledger head (operator-controlled)

GREEN requires production deployment SHA = approved SHA.
