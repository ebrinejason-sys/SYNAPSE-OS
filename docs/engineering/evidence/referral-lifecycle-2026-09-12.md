# Referral lifecycle (RC1) — 2026-09-12

## Scope
Facility referral domain: create → accept → complete (plus reject/cancel), with same-facility guard.

## Layers
1. **Domain** — `@synapse/db/referral-lifecycle` + `runReferralGoldenJourney`
2. **HTTP** — `GET`/`POST`/`PATCH` `/api/facility/referral`
3. **UI** — `/referrals`, `/referrals/new`, `/referrals/[id]`
4. **Evidence** — `npm run test:referral-lifecycle`

## Live synthetic
Not yet run against production tenants (needs two linked facility tenants). Next after HTTP route tests land.
