# MFA step-up live probe — 2026-09-12

## Result
- Schema readiness: **PASS**
- Verified enrollments: **2** (includes `ebrinetushabe@gmail.com`)
- Admins with MFA (`is_admin` / platform control): **2**
- Live TOTP round-trip: **NOT_RUN_NEEDS_LIVE_AUTHENTICATOR_CODE**

## Proofs already in tree
- Domain: `packages/auth/src/mfa-recency.test.ts`
- HTTP: `apps/web/src/app/api/platform/mfa/step-up/route.test.ts` (5 cases: unauth, malformed, incorrect, not enrolled, success)

## Remaining gate
Provide a 6-digit code from an enrolled platform admin authenticator (e.g. `ebrinetushabe@gmail.com`) while signed into platform control, then call `POST /api/platform/mfa/step-up`. Until then, do **not** claim live TOTP PASS.

## Probe
```bash
node scripts/mfa-step-up-live-probe.mjs --project-ref qfqakzmjatszisuqjwon
```
