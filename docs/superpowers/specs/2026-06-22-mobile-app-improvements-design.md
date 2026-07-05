# Mobile App Improvements — Design Spec
**Date:** 2026-06-22  
**Approach:** C — Infrastructure-first, then role screens  
**Stack:** Expo SDK 52, React Native 0.76, expo-router, Next.js 15 API routes

---

## Goal

Elevate the Synapse mobile app from a read-only dashboard companion to a fully functional role-gated clinical workspace. Every role gets only what's relevant to them; shared infrastructure (notifications, cache, drill-down) is built once.

---

## Layer 1 — Foundation

### 1A. Offline Cache (`lib/cache.ts`)
- Thin stale-while-revalidate wrapper around `apiRequest` using `@react-native-async-storage/async-storage`
- Shows cached data immediately on screen mount; fetches fresh in background
- TTLs: dashboard/queue = 5 min, patients = 15 min, records/meds/stock = 60 min
- `useCachedRequest<T>(path, token, ttl)` hook returned from the wrapper

### 1B. Push Notifications (`lib/notifications.ts`)
- Register device via `expo-notifications` on login; POST token to `/api/mobile/push-token`
- Server stores token in `mobile_push_tokens (id, user_id, token, role, tenant_id, updated_at)`
- Notification deep-links use existing `app:` / `web:` target scheme
- Per-role triggers (server-side, fired from existing DB events):

| Role | Trigger | Target |
|---|---|---|
| Patient | Appointment reminder (24h before) | `app:/appointments` |
| Patient | Lab result ready | `app:/records` |
| Clinician / Nurse | New patient in queue | `app:/queue` |
| Clinician / Nurse | Patient waiting > 30 min | `app:/queue` |
| Pharmacy | Product at reorder level | `app:/stock` |
| Pharmacy | Product expiring in 7 days | `app:/stock` |
| Admin | Broadcast alert | `app:/home` |

### 1C. Drill-down Navigation Primitives (`components/ui/`)
- `DetailScreen` — full-screen layout with back button, title, optional subtitle
- `DetailRow` — label / value pair with optional highlight + copy-on-press for MRN/IDs
- `DetailSection` — titled section separator for grouping rows
- All new detail screens are native stack routes (expo-router `(stack)` group)

---

## Layer 2 — Role Screens

### 2A. Clinical Staff (doctor, nurse, reception, admin)
- **Queue fix:** `openEncounter` currently opens generic `/os`; fixed to `/os/encounters/{encounterId}`
- **Queue tap → Encounter Detail** (`app/encounter/[id].tsx`): patient name, MRN, chief complaint, clinical stage, vitals summary, status badge; CTA "Open full chart" deep-links to web OS
- API: `GET /api/mobile/encounter/[id]`

### 2B. Patient
- **Records tap → Record Detail** (`app/record/[id].tsx`): full visit notes, diagnoses, vitals, ordering provider
- **Appointment tap → Appointment Detail** (`app/appointment/[id].tsx`): provider, facility, time, status; CTA "Cancel" (if upcoming + > 2h)
- **Meds tap → Medication Detail** (`app/medication/[id].tsx`): prescribing encounter, dose, frequency, refills
- API: `GET /api/mobile/records/[id]`, `GET /api/mobile/appointments/[id]`, `DELETE /api/mobile/appointments/[id]`, `GET /api/mobile/medications/[id]`

> In-app booking flow (originally spec'd as `app/book-appointment.tsx`) is **out of scope** for this plan. `appointments.tsx` already deep-links to the web telemedicine booking flow and nothing is broken without it — it's a future enhancement, not a gap in "does the app work."

### 2C. Pharmacy
- **Stock tap → Item Detail** (`app/stock-item/[id].tsx`): batch, unit, expiry, reorder level
- API: `GET /api/mobile/inventory/[id]`

### 2D. Lab (new tab)
- `app/(main)/lab.tsx` tab: list of pending lab orders (patient, test, ordered by, ordered at, status) — **screen already built, calls `GET /api/mobile/lab` which does not exist yet**
- API: `GET /api/mobile/lab`

### 2E. Billing (new tab)
- `app/(main)/claims.tsx` tab: claims list (patient, amount, insurer, status, submitted date) — **screen already built, calls `GET /api/mobile/claims` which does not exist yet**
- API: `GET /api/mobile/claims`

---

## Layer 3 — Enhancements

### 3A. Biometric Re-auth
- `expo-local-authentication` — prompt on app foreground after 5 min backgrounded
- `lib/auth.tsx` already implements the `AppState` listener and sets `isLocked: true`, and exposes `unlock()` — **but no UI ever consumes `isLocked`, so a locked session is currently invisible** (the app just keeps showing whatever screen was open). Needs a `LockScreen` component gating the whole app.
- Falls back to native device passcode (via `disableDeviceFallback: false`) or forces logout on cancel — no separate OTP re-login screen needed since `logout()` already routes back to `/(auth)/login`.

### 3B. Navigation wiring
- `app/(main)/_layout.tsx`, `lib/navigation.ts` — lab and claims tabs **already wired** (done in a prior session).

---

## Implementation Status (as of 2026-07-04)

A prior session implemented most of Layers 1C, 2A–2E (client-side) and 3B, and started 1B/3A. Verified via direct code inspection:

**Done and working:**
- Tab visibility per role (`lib/navigation.ts`, `app/(main)/_layout.tsx`) — confirmed correct and comprehensive.
- Server-side dashboard content resolution (`GET /api/mobile/dashboard`) — confirmed correct, comprehensive `ROLE_KIND` map, used as source of truth by `home.tsx`.
- Detail screens exist client-side for encounter, record, appointment, medication, stock-item, and list screens for lab, claims — all reachable via tap-through from their parent list screens.
- `lib/cache.ts` — complete, but not wired into any screen (`home.tsx`/`patients.tsx` still use ad hoc `useState`/`useEffect`). Out of scope for this plan (YAGNI — screens work fine without it; wiring it in is a pure performance/offline enhancement, not a functional gap).

**Broken or missing — this plan's scope:**
1. `apps/app/lib/auth.tsx` imports `expo-notifications`, `expo-local-authentication`, `expo-device` — **none of the three are declared in `package.json` or installed**. This breaks the Metro bundle / type-check today.
2. `/api/auth/mobile/me` has its own **stale** `ROLE_KIND` map (11 roles) that diverges from the canonical map in `apps/app/lib/roles.ts` / `apps/web/src/app/api/mobile/dashboard/route.ts` (60+ roles). Currently harmless (nothing reads `user.dashboardKind`) but a live landmine for future code — fix now while touching this area.
3. No `mobile_push_tokens` table, no `POST`/`DELETE /api/mobile/push-token` route — push registration silently no-ops today (wrapped in `.catch(() => {})`).
4. Six detail/list API routes are missing entirely, so their screens show a permanent error/empty state:
   - `GET /api/mobile/encounter/[id]` (queue tap-through)
   - `GET /api/mobile/records/[id]`
   - `GET /api/mobile/appointments/[id]` + `DELETE /api/mobile/appointments/[id]` (cancel)
   - `GET /api/mobile/medications/[id]`
   - `GET /api/mobile/inventory/[id]`
   - `GET /api/mobile/lab`
   - `GET /api/mobile/claims`
5. `isLocked` state exists with no consuming UI — biometric lock is invisible to the user.

---

*Synapse Health Technologies · Kampala, Uganda*
