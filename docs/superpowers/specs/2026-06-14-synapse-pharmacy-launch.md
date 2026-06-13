# Synapse Pharmacy Launch — Full Design Spec

**Date:** 2026-06-14  
**Author:** Ebrine Tushabe  
**Scope:** DB reset, auth foundation, pharmacy invite-only onboarding, admin command center, unified mobile nav

---

## Overview

Four phases executed in parallel after a shared foundation:

```
Phase 0: DB clean slate + auth verify + Resend smoke test
    ↓
Phase 1A (parallel):         Phase 1B (parallel):
Admin command center         Pharmacy invite → onboarding
    ↓                               ↓
Phase 2: Unified mobile-responsive nav (both apps)
```

---

## Phase 0 — Foundation

### DB Clean Slate (full wipe, order respects FK)

1. `synapse_sessions` — all rows
2. `auth_otps` — all rows
3. `pharmacy_onboarding` — all rows
4. `pharmacy_profiles` — all rows
5. `pharmacy_stores` — all rows
6. `pharmacy_products` — all rows
7. `tenants` — all rows
8. `profiles` — all rows
9. `auth.users` — all users (Supabase admin API)

### Seed accounts (post-wipe)

| Account | Email | Role |
|---|---|---|
| Ebrine (you) | ebrinetushabe@gmail.com | platform_admin |
| Nathan | [nathan-email-placeholder] | platform_admin |

Both accounts: OTP-only login (no password_hash), must be invited via Supabase Auth invite or created via admin API.

### Resend smoke test

- Trigger OTP to ebrinetushabe@gmail.com
- Confirm email arrives, OTP verifies, `synapse_session` cookie is set
- Confirm logout revokes session

### Auth acceptance criteria

- [ ] OTP email arrives via Resend < 30s
- [ ] OTP verify sets `synapse_session` cookie
- [ ] Invalid OTP returns clear error (not 500)
- [ ] Logout clears cookie + revokes session row
- [ ] Protected route without session → redirect to `/login`

---

## Phase 1A — Admin Command Center

**App:** `apps/web` — `src/app/platform/`

### Navigation (sidebar groups)

```
OPERATIONS
  Overview          /platform
  Tenants           /platform/tenants
  Provision         /platform/tenants/provision  ← NEW
  Applications      /platform/applications
  Approvals         /platform/approvals

FINANCIALS
  Billing           /platform/billing
  Sales             /platform/sales

SYSTEM
  Feature Flags     /platform/feature-flags
  Audit Log         /platform/audit-log
  Broadcasts        /platform/broadcasts
  System Health     /platform/system/health
  Support           /platform/support
  Impersonation     /platform/impersonation

ACCOUNT
  Account           /platform/account
```

### Overview dashboard (`/platform`)

Stats cards:
- Total pharmacies | Active | In onboarding | Trial expiring ≤ 7 days

Recent activity feed (last 10 events from `audit_log`).

Quick actions: "Provision pharmacy", "View pending approvals".

### Provision page (`/platform/tenants/provision`)

Form fields:
- Pharmacy name (required)
- Owner full name (required)
- Owner email (required)
- District / city
- Plan = "Free Trial" (fixed for now)

On submit:
1. Create `tenants` row (`facility_type: 'pharmacy'`, `status: 'pending'`)
2. Create `profiles` row (`role: 'pharmacy_admin'`, `must_change_password: true`)
3. Generate signed invite token (JWT, 72h expiry) → store in `invite_tokens` or use existing invite mechanism
4. Send invite email via Resend → `pharm-{slug}.synapseos.tech/invite/{token}`
5. Show confirmation + copyable invite link

### Tenant detail (`/platform/tenants/[id]`)

Enhancements:
- Onboarding step progress indicator (steps 1–5)
- Trial expiry date + plan badge
- "Resend invite" button
- "Impersonate" button
- Activate / Suspend toggle

---

## Phase 1B — Pharmacy Invite → Onboarding Flow

**App:** `apps/pharmacy`

### Invite acceptance (`/invite/[token]`)

Already exists at `apps/pharmacy/app/invite/[token]/`. Enhance to:
- Validate token (not expired, not used)
- Show pharmacy name + owner name from token payload
- Let owner set a password
- On submit: create `synapse_session` cookie, mark token used, redirect to `/onboarding`

### Onboarding form (5 steps — existing page enhanced)

`apps/pharmacy/app/onboarding/page.tsx` — update session loading from Supabase client → `/api/auth/session` endpoint (uses `synapse_session` cookie).

Step enhancements:
- **Step 1 Pharmacy Profile**: Add NDA license number validation format, add operating hours
- **Step 2 Store Setup**: Add physical address, GPS coordinates optional  
- **Step 3 Products**: Keep as-is (can skip)
- **Step 4 Network**: Keep as-is
- **Step 5 Complete**: Add "What's next" tips, link to dashboard

### Post-onboarding

- `middleware.ts` redirect: if `pharmacy_onboarding.current_step < 5` → `/onboarding`
- After step 5: redirect to `/portal/dashboard`

---

## Phase 2 — Unified Mobile-Responsive Nav

**Design language:** Consistent across both apps.

### Pharmacy app (`apps/pharmacy/app/portal/layout.tsx`)

- Sidebar already works on desktop with hamburger on mobile
- Improvements: group nav items into sections (Inventory, Sales, Finance, Admin), add section headers, collapse long list into grouped accordion on mobile
- Bottom tab bar on mobile (5 most-used: Dashboard, Inventory, POS, Orders, More)

### Web app (`apps/web`)

- Implement consistent sidebar pattern matching pharmacy app
- Mobile: hamburger → slide-in drawer
- Collapsible sections per department (Doctor, Nurse, Lab, Admin, etc.)
- Breadcrumb on mobile top bar

### Shared design tokens

Both apps use the same nav color variables:
- Active item: `bg-primary/10 text-primary border-l-2 border-primary`
- Hover: `hover:bg-muted/50 hover:text-foreground`
- Section header: `text-[10px] uppercase tracking-widest text-muted-foreground`

---

## Out of Scope (this spec)

- Payment/billing collection at onboarding (free trial only)
- Hospital/clinic self-service signup (invite-only for pharmacies)
- Mobile app (Expo) auth
- Supabase Auth removal (30-day transition window per auth-migration plan)
- Nathan's exact email (placeholder until confirmed)
