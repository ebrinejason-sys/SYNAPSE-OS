# Proposed: hash facility invitation secrets at rest (20261002150000)

**Status: applied to LOCAL Supabase only. NOT applied to production.**

## Problem
Hospital/pharmacy provisioning stored the invite secret in plaintext
(`facility_invitations.invite_token`). Anyone with DB read access (backups, a
leaked service key, support tooling) could redeem a live invite and set the
admin password.

## Change
- App (`@synapse/db/facility-invite-token`): 32-byte crypto-random token; only
  `token_hash = sha256_hex(token)` is persisted; constant-time compare; lookups by
  hash. Redeem atomically claims the invite (`status IN (PENDING,SENT) AND
  expires_at > now()`) BEFORE writing the password, so replays/concurrent use fail.
- Migration: backfills `token_hash` for every plaintext row, nulls `invite_token`
  in the same UPDATE (satisfies the existing XOR constraint), then adds
  `facility_invitations_no_plaintext_token CHECK (invite_token IS NULL)`.

## Prod data (read-only, 2 Oct 2026)
12 rows (5 ACCEPTED, 6 PENDING, 1 SENT), all plaintext, **0 unexpired** — no live
invitation is affected. `token_hash` column already exists in prod.

## Deploy order (important)
1. Deploy the app (reads `token_hash`, falls back to legacy plaintext rows).
2. Apply this migration. Applying it before the app deploy would make the OLD app
   insert plaintext → rejected by the new CHECK (provisioning invite step fails).

## Rollback
`alter table public.facility_invitations drop constraint facility_invitations_no_plaintext_token;`
Plaintext cannot be restored by design; re-send affected invites (issues a fresh secret).

## Not covered (post-release)
`pharmacy_onboarding.invite_token` (legacy `/invite/<token>` flow): 5 prod rows,
1 unexpired. Separate table/flow; hash it in a follow-up.
