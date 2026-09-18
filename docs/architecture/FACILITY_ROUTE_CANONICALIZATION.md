# Facility route canonicalization

**Status:** CURRENT  
**Date:** 2026-09-18

Canonical production hospital shell is **facility-scoped** `/os/[slug]` plus capability-based satellites:

- Clinical doctor workspace: `/os/[slug]/clinical/queue` (also `/doctor` when tenant is known)
- Nursing workspace: `/os/[slug]/clinical/nursing` (also `/nurse`)
- Reception / MPI registration: `/os/[slug]/patients` and `/os/[slug]/encounters/new`
- Billing + encounter timeline: `/os/[slug]/clinical/orders` and `/encounter/[id]/*`
- Facility admin: `/hospital/admin`
- Laboratory: `/lab/*`
- Pharmacy bridge: `/os/[slug]/clinical/dispense` and `/pharmacy/queue`

Domain APIs (`/api/opd/*`, `/api/hospital/*`, `/api/lab/*`) are unchanged.

## Old → canonical

| Old / competing | Canonical | Compatibility |
|---|---|---|
| `/doctor`, `/doctor/queue` | `/os/[slug]/clinical/queue` | `/doctor` is the real workspace; queue still redirects |
| `/doctor/{ai,consults,notes,reports,rounds,schedule,tele}` | `/doctor` | next.config redirect |
| `/doctor/referrals` | `/referrals` | redirect |
| `/nurse`, `/nurse/queue` | `/os/[slug]/clinical/nursing` | `/nurse` is the real workspace |
| `/nurse/{beds,handover,mar,observations,procedures}` | `/nurse` | redirect |
| `/consults/*` | `/doctor` | redirect |
| `/encounter/new` | `/os/[slug]/encounters/new` | tenant-aware redirect |
| `/encounter/[id]/orders` | orders/billing/timeline panel | implemented |
| `/encounter/[id]/history` | encounter timeline | implemented |
| `/dept/opd/queue` | `/os/[slug]/clinical/queue` | tenant-aware redirect |
| `/dept/*` specialty stubs | none (ROADMAP, not in production nav) | pages remain, not linked |
| `/admin` | `/hospital/admin` for facility ops; `/admin/finance|hr|insurance` remain ops | login for `hospital_admin` → `/hospital/admin` |
| `/admin/lab` | `/lab/orders` | redirect |
| `/admin/supply/orders` | `/admin/supply` | redirect |
| `/admin/settings/{branding,domain,guidelines}` | `/hospital/admin/settings` | redirect |
| `/lab/reports` | `/lab/results` | redirect |
| `/os/[slug]/clinical` (missing index) | `/os/[slug]/clinical/queue` | redirect |
| `/os/[slug]/admin` (missing) | `/hospital/admin` | resolver fix |

Specialty department pages (`/dept/maternity/*`, ICU, oncology, …) are **ROADMAP**. They must not appear in production navigation.
