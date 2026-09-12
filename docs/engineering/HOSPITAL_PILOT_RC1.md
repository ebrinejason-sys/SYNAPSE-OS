# SYNAPSE Hospital Pilot RC1

## Goal
One demonstrable facility workflow — not every module GREEN.

## RC1 must prove
1. Facility provisioned cleanly
2. Staff invited securely (hashed-token invite journey)
3. One OPD patient journey: arrival → payment/disposition
4. Lab and Pharmacy handoffs proven where in-path
5. Tenant isolation + audit on actions in the path
6. Reload/retry/idempotency on dispense and payment
7. Admin shows real service/release status (SHA alignment)
8. No dead-end links in the Golden Journey UI for this path

## Already landed evidence (2026-09-11)
- Migration ledger unlock + invite journey (PR #57)
- Domain OPD→dispense golden (PR #58)
- HTTP prescribe/dispense route tests (PR #59)
- Live synthetic dispense + `pharmacy_product_batches` stock fix (PR #60)

## Next coding targets (depth order)
1. Doctor encounter write-up completeness (HPI/PMH/ROS/exam/assessment/plan/sign/amend)
2. Billing collect + disposition + close gates as one coherent closeout
3. Wire a single Hospital Golden Journey runner across those steps
4. Then admissions/transfer/discharge, referrals, clinical offline

## Engineering standard
Every feature: domain logic → HTTP/API proof → live synthetic journey → readiness evidence.


## Progress — 2026-09-11
- Clinical write-up domain + HTTP + notes UI landed (see `docs/engineering/evidence/clinical-writeup-2026-09-11.md`).
- Professional light mode tokens restored to orange/gold brand (light mode no longer swaps primary to blue).
- Marketing hero chrome quieted (no particle field; reduced aurora/shimmer) while retaining module/pricing content.

- Closeout golden: billing balance → payment → disposition → close (`docs/engineering/evidence/hospital-closeout-golden-2026-09-11.md`).

- Full Hospital Golden Journey domain runner (`docs/engineering/evidence/hospital-golden-journey-2026-09-11.md`).

- Live synthetic Hospital Golden Journey PASS (`docs/engineering/evidence/hospital-golden-live-2026-09-12.md`).
- Domain golden optional lab branch + inpatient admit/transfer/discharge foundation.

- Referrals domain + HTTP/UI foundation (`docs/engineering/evidence/referral-lifecycle-2026-09-12.md`).
- Disposition columns migration applied to pilot Supabase (2026-09-12).

- Live two-tenant referral journey PASS (`docs/engineering/evidence/referral-live-2026-09-12.md`).
- Clinical offline write-up SyncCommand slice (`docs/engineering/evidence/clinical-offline-writeup-2026-09-12.md`).
- HTTP hospital sync flush for write-up SyncCommand (`docs/engineering/evidence/hospital-sync-apply-writeup-2026-09-12.md`).
- MFA step-up: schema + HTTP proofs + **live TOTP PASS** (`docs/engineering/evidence/mfa-step-up-live-2026-09-12.md`).

- Admin SHA alignment (GitHub ↔ Vercel ↔ process ↔ migration ledger) (`docs/engineering/evidence/admin-sha-alignment-2026-09-12.md`).
- Stripped unused `LandingParticleField` (landing already quieted in #62).

- Clinical offline disposition SyncCommand (`docs/engineering/evidence/clinical-offline-disposition-2026-09-12.md`).

- Offline triage SyncCommand (`docs/engineering/evidence/clinical-offline-triage-2026-09-12.md`).
- Admin Hospital Pilot RC1 pulse scoreboard (`docs/engineering/evidence/rc1-pulse-2026-09-12.md`).

- Offline prescribe SyncCommand (`docs/engineering/evidence/clinical-offline-prescribe-2026-09-12.md`).
