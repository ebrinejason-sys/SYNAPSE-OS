# Lab actions HTTP auth — 2026-09-13

## Scope
Vitest HTTP proofs for `POST /api/lab/actions` authorization boundaries.

## Proofs (mocked auth/DB — not live browser, not RLS)
- Unauthenticated → 401; no `executeHospitalLabAction`
- `lab_tech` blocked from verify/release/amend → 403
- `lab_scientist` release allowed after `result/verify/lab` capability
- Reject reason (`hemolyzed`) passed through `extra`
- Body `tenantId` ignored; action uses authenticated `ctx.tenantId`

## SHA
Recorded against branch work leading to this evidence file; cite `git rev-parse HEAD` at merge.

## Run
```bash
npm run test:lab-actions
```

## Explicitly NOT claimed
- Browser → API → Postgres journey
- Cross-tenant RLS with real JWT
- Live pilot specimen/TAT
