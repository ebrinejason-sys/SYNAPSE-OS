# Proposed: Postgres-backed distributed rate limiter (20261002160000)

**Status: applied to LOCAL Supabase only. NOT applied to production.**

- New table `auth_rate_limit_buckets` (RLS on, no anon/authenticated grants) and
  `consume_auth_rate_limit(key, limit, window_seconds)` (service_role only): one
  atomic `INSERT ... ON CONFLICT DO UPDATE` fixed-window counter shared by every
  serverless instance. Opportunistic retention (~1% of calls drop buckets idle > 1 day).
- Keys are HMAC-SHA256(pepper, "<scope>|<identifier>") computed in the app; the DB
  CHECK only accepts 64-hex keys, so raw IPs/emails cannot be stored.
- Pepper: `RATE_LIMIT_PEPPER` (optional; falls back to `SYNAPSE_JWT_SECRET`).
- Uses: Pharmacy self-serve signup (5/15 min per IP, 3/h per email) and supervisor
  approval lockout. No new paid dependency (Upstash stays optional for apps/web).

Deploy order: either. Without the migration the app falls back to the per-instance
in-memory limiter (never fails open). Rollback: drop the function and table.
Tests: `npm run test:pharmacy-concurrency` (includes auth-rate-limit.local.test.mjs).
