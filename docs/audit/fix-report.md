# SYNAPSE Audit Fix Report

**Date:** 2026-06-18  
**Branch:** main  

---

## Completed in this pass

### Auth (Task 2)
- **`@synapse/auth/redirects`** — role-based `redirectTo` after email OTP verify
- **`@synapse/auth/tenant-guard`** — hospital subdomain tenant match in `getContext`
- **Web middleware** — rejects session when host hospital tenant ≠ session tenant
- **`scripts/seed-admin-password.ts`** — operator script for accounts without password (uses `must_change_password`)
- **Mobile login** — password → email OTP → JWT (`/api/auth/mobile/login` + `/api/auth/mobile/otp-verify`)
- **Pharmacy otp-verify** — cookie set on `NextResponse` (Next.js 15 fix)

### Pharmacy (Task 4 partial)
- **`generateReceiptNumber()`** — `RX-YYYYMMDD-NNNN` per tenant/day
- **POS** — blocks with `NO_STORE` when `pharmacy_stores` empty; uses receipt generator

### Expo (Task 3 partial)
- Login OTP step in app UI
- Patient home screen + role-based index redirect

### Documentation (Task 1)
- `docs/audit/codebase-audit.md`

---

## Proof status

| Check | Status | Notes |
|-------|--------|-------|
| `next build` @synapse/web | **NOT VERIFIED locally** | `next` CLI/types incomplete in local `node_modules`; failed typecheck pulled in `apps/app`. Run `npm ci` then `npm run verify:web` on CI/Vercel. |
| `next build` @synapse/pharmacy | **NOT VERIFIED locally** | Same environment issue |
| Live HTTP login 200 | **NOT RUN** | Requires deployed env + test creds |
| POS sale SQL row | **NOT RUN** | Requires store + inventory in tenant |
| Seed Nathan account | **NOT RUN** | Run: `SUPABASE_* npm run seed:admin-password -- nathandavid762@gmail.com` |

---

## Operator next steps

1. `npm ci` at repo root  
2. Seed Nathan: `npm run seed:admin-password -- nathandavid762@gmail.com`  
3. Push migration `20260614000001_password_reset_tokens.sql` if not applied  
4. Complete onboarding for existing pharmacy tenants (creates `pharmacy_stores`)  
5. Re-run audit Tasks 5–6 (admin dashboard, hospital Path B)

---

## Commits (this pass)

See git log after push — grouped as auth, pharmacy POS, mobile/expo, docs.
