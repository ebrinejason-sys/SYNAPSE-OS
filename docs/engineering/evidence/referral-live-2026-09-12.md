# Facility referral — live synthetic (2026-09-12)

## Result
**PASS** against pilot Supabase `qfqakzmjatszisuqjwon`.

- From: `synthetic-hospital-20260903`
- To: `synapse-acceptance-hospital-two`
- Evidence: `docs/engineering/evidence/referral-live-2026-09-12T19-22-10-620Z.json`

## Path
create encounter → create `facility_referrals` (pending) → disposition `REFERRAL` → accept → complete → cleanup

## Re-run
```bash
npm run journey:referral-live
```
