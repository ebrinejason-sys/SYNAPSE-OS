# SYNAPSE-OS Codebase Audit

**Generated:** 2026-06-18  
**Supabase project:** `qfqakzmjatszisuqjwon` (212 tables, 75 migrations live)  
**Repo:** `C:\Users\ebrin\SYNAPSE-OS`

---

## Executive summary

| Metric | Count |
|--------|------:|
| Web pages (`apps/web`) | 229 |
| Web API routes | 74 |
| Pharmacy pages | 29 |
| Pharmacy API routes | 48 |
| Expo screens | 8 (+ layouts) |
| Shared packages | 5 (`auth`, `config`, `db`, `email`, `ui`) |
| Dead files removed this pass | 0 (prior pass removed `apps/web/src/lib/otp.ts`) |
| Legacy Supabase Auth call sites remaining | 6 (see §1B) |
| OTP implementations | 1 canonical (`packages/auth/src/otp.ts`, `crypto.randomInt`) |

### Risky patterns (priority)

1. **Web middleware skips all `/api/*`** — route-level guards required; many AI/import routes now guarded, others still open.
2. **Mobile was password-only** — fixed: password → email OTP → JWT (`/api/auth/mobile/login` + `/otp-verify`).
3. **Login default redirect was `/health/dashboard` for all roles** — fixed: `getPostLoginPath()` in `@synapse/auth/redirects`.
4. **`pharmacy_stores` empty in live DB** — onboarding step 2 creates default store; POS now blocks with `NO_STORE` until one exists.
5. **Receipt numbers were random `TXN*` / `RX-${Date.now()}`** — POS uses `RX-YYYYMMDD-NNNN` per tenant/day via `generateReceiptNumber()`.
6. **Host/tenant mismatch** — web middleware + `getContext` now reject cross-tenant hospital subdomain access.
7. **Nathan account (`nathandavid762@gmail.com`)** — no password; use `npm run seed:admin-password -- <email>` with service role.

---

## 1A. Route inventory

Full route tables: 229 web pages, 74 web APIs, 29 pharmacy pages, 48 pharmacy APIs, 8 Expo screens.

### Critical auth routes

| URL | App | Methods |
|-----|-----|---------|
| `/api/auth/password-login` | web | POST |
| `/api/auth/email-otp/verify` | web | POST (+ `redirectTo`) |
| `/api/auth/mobile/login` | web | POST (OTP step 1) |
| `/api/auth/mobile/otp-verify` | web | POST (OTP step 2) |
| `/api/auth/login` | pharmacy | POST |
| `/api/auth/otp-verify` | pharmacy | POST |
| `/api/admin/pos/transaction` | pharmacy | POST |

---

## 1B. Dead / legacy code

| Candidate | Status |
|-----------|--------|
| `apps/web/src/lib/otp.ts` | Deleted (prior pass) |
| `packages/auth/src/otp.ts` | USED — canonical |
| `supabase.auth.getUser()` | 6 remaining legacy sites |
| MFA JWT outside `@synapse/auth/mfa` | None |

---

## Package exports

See `packages/auth`, `packages/db`, `packages/email`, `packages/config`, `packages/ui` — documented in package `exports` fields.

---

## Environment variables

Core: `NEXT_PUBLIC_SUPABASE_*`, `SUPABASE_SERVICE_ROLE_KEY`, `SYNAPSE_JWT_SECRET`, `RESEND_API_KEY`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_PHARMACY_APP_URL`, `ADMIN_EMAILS`, `VERCEL_TOKEN`.

---

## Changes applied (2026-06-18)

1. `@synapse/auth/redirects` — role-based post-login paths  
2. `@synapse/auth/tenant-guard` — host tenant match in `getContext`  
3. Web middleware — cross-tenant hospital subdomain guard  
4. `scripts/seed-admin-password.ts`  
5. `apps/pharmacy/lib/receipt-number.ts` — RX-YYYYMMDD-NNNN  
6. POS store gate + receipt numbers  
7. Mobile OTP login + Expo patient home  

---

## Remaining

- Admin dashboard full wiring (Task 6)  
- `fix-report.md` with live HTTP/SQL proofs  
- Both `next build` green locally (requires `npm ci`)  
- Design token migration per design spec  
