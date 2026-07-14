# Platform Admin Control Plane — Design Spec

**Date:** 2026-07-14
**Status:** Approved (brainstorm session with founder)
**Branch strategy:** `platform-build/control-plane` + PR to `main`
**Scope:** `apps/web` `/platform/*` routes, `/api/platform/*` APIs, two additive migrations

---

## Goal

Make `/platform` a true control plane for the whole Synapse ecosystem — the platform admin can **see** and **manage** all three verticals (Hospital OS, Pharmacy, Mobile App) from one place. Today the overview covers hospitals + pharmacies partially, hospital modules are read-only from platform, and the mobile app is invisible.

## Non-goals

- No rewrite of the legacy `/admin` console (link hygiene only; `/hospital/admin` is the canonical hospital-side console).
- No new department APIs (hospital activity metrics read existing tables directly).
- No pharmacy POS money-path changes (`apps/pharmacy` untouched).
- No auto-send of anything: broadcasts and subscription changes always require explicit human confirmation (Hard Gate 5).

---

## 1. Information architecture

Nav in `/platform/layout.tsx` reorganizes into six groups:

| Group | Contents |
|---|---|
| Overview | `/platform` command center |
| Hospitals | `/platform/hospitals`, `/platform/hospitals/[id]`, `/platform/hospitals/new`, applications/approvals (hospital leads) |
| Pharmacies | `/platform/pharmacies` (new index), `/platform/pharmacies/onboard`, `/platform/pharmacy-network` |
| App | `/platform/app` (new) |
| Revenue | `/platform/billing`, `/platform/sales`, `/platform/analytics` |
| Platform Ops | security, feature-flags, audit-log, system, users, support, broadcasts, dhis2, public-health, guidelines, settings |

Changes:
- `/platform/flags` content merges into `/platform/feature-flags`; `/platform/flags` becomes a redirect.
- Remove any platform links that deep-link into legacy `/admin/*` pages; point hospital-console links at `/hospital/admin`.

## 2. Overview command center

Extend `getOverviewData()` + `OverviewCommandCenter` with a three-vertical KPI strip (all server-side `supabaseAdmin` reads):

- **Hospital OS:** active hospital tenants; encounters created last 7d; patients registered last 7d.
- **Pharmacy:** active pharmacy tenants; `pharmacy_transactions` count + UGX volume last 7d.
- **App:** distinct users with a `synapse_sessions.app = 'mobile'` session last 30d; currently-active mobile sessions; `apk_waitlist` count.

Existing cards (KYC, tickets, applications, audit feed, etc.) are preserved.

## 3. Hospitals hub

`/platform/hospitals/[id]` upgrades from read-only to a tenant console with four panels:

1. **Modules** — toggle `hospital_modules` rows per tenant. Server action wraps the same logic as `lib/hospital-shared/modules.ts` / `/api/hospital/admin/modules`; every toggle writes an `audit_log` row (`action: 'platform.module.toggle'`). Confirmation dialog before disable.
2. **Subscription** — shows current `tenant_subscriptions` row (plan, status, period, trial/grace dates). Actions: change plan, extend trial, suspend, reactivate, cancel-at-period-end. Allowed transitions: `trialing → active | suspended`, `active → past_due | suspended | canceled`, `past_due → active | suspended`, `suspended → active`, any → `canceled`. Each transition is a server action, audit-logged, additive (no row deletion).
3. **Activity** — 7d/30d counts per tenant from `encounters`, `patients`, `consult_queue`. Direct table reads; no dependency on missing department APIs.
4. **Access** — impersonate button (existing `POST /api/platform/impersonate`), link to the tenant's `/os/[slug]/dashboard` and `/hospital/admin`.

## 4. Pharmacies hub

New `/platform/pharmacies` index page: table of pharmacy tenants (`tenants.facility_type = 'pharmacy'`) with onboarding stage (`pharmacy_onboarding.current_step`), last POS transaction time, 7d revenue, status. Row → detail view reusing the same Subscription + Access panels as hospitals (shared `_components`). Existing `/pharmacies/onboard` flow and `/pharmacy-network` page stay, linked from the hub.

## 5. App hub

New `/platform/app`:

- **KPIs:** app users by role (profiles joined to mobile sessions), active mobile sessions, push-enabled device count (`mobile_push_tokens`), APK waitlist size.
- **Waitlist:** table of `apk_waitlist` rows.
- **Broadcast composer:** audience = all app users / filter by role / filter by tenant. Channels: **push** (Expo Push API over `mobile_push_tokens`), **SMS/email** (reuse existing broadcast server actions). Preview + explicit confirm step before any send.

### New tables (additive migration)

```sql
create table if not exists app_broadcasts (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references profiles(id),
  title text not null,
  body text not null,
  audience jsonb not null,          -- { roles?: [], tenant_ids?: [] }
  channels text[] not null,         -- ['push','sms','email']
  status text not null default 'draft',  -- draft|sending|sent|failed
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists app_broadcast_deliveries (
  id uuid primary key default gen_random_uuid(),
  broadcast_id uuid not null references app_broadcasts(id) on delete cascade,
  user_id uuid references profiles(id),
  channel text not null,
  status text not null default 'queued', -- queued|sent|delivered|failed
  error text,
  created_at timestamptz not null default now()
);
```

Both tables get RLS (platform_admin only) and indexes on `broadcast_id`, `user_id`.

Push sending: server action batches tokens to the Expo Push API (`https://exp.host/--/api/v2/push/send`, 100/batch), records per-user delivery rows, marks invalid tokens for cleanup.

## 6. Cross-cutting rules

- Every page/action behind `requirePlatformAdmin`.
- Every write → `audit_log` row.
- Migrations additive only (`create table if not exists`, no drops).
- Typed server-action results; human-readable errors in UI (never raw JSON).
- No new `any`; follow existing `/platform/_components` + `_lib` patterns.

## 7. Delivery & verification

Four independently-shippable phases on `platform-build/control-plane`:

| Phase | Contents |
|---|---|
| 1 | Nav/IA regroup, flags merge + redirect, overview three-vertical strip |
| 2 | Hospitals hub (modules toggle, subscription panel, activity, access) |
| 3 | Pharmacies hub (index + shared panels) |
| 4 | App hub (KPIs, waitlist, broadcast + delivery tracking, migration) |

Per-phase verification: `npm run type-check`, `npm run verify:web`, dev-server smoke of every touched page. Phase 4 adds proof-gate SQL: new tables exist, RLS enabled, zero broadcast rows after migration.
