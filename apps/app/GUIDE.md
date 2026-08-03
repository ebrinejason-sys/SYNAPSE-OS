# Synapse Mobile App — Developer Guide

> **Package:** `@synapse/app` · **Stack:** Expo SDK 52, React Native 0.76, expo-router
>
> **Ecosystem authority:** [`docs/SYNAPSE_ECOSYSTEM_OPERATING_MODEL_2026.md`](../../docs/SYNAPSE_ECOSYSTEM_OPERATING_MODEL_2026.md)
>
> **Technical evidence:** [`docs/SYNAPSE_MASTER_BLUEPRINT_2026.md`](../../docs/SYNAPSE_MASTER_BLUEPRINT_2026.md)

This guide describes the current mobile code and build flow. It is not the source of truth for product maturity, offline guarantees, clinical scope, or ecosystem ownership.

---

## 1. What this app is

Synapse is a three-product health ecosystem: Synapse OS for facility care, Synapse Pharm for medicines and supply operations, and Synapse App for patients, caregivers, communities, and mobile workforces. The **mobile app** is an ecosystem citizen—not a standalone shell:

| Audience | Mobile role |
|---|---|
| **Patients** (`role: patient`) | Personal health: records, appointments, medications, notifications |
| **Clinical staff** (doctor, nurse, reception, admin) | Today's queue, patient search, role dashboard, deep-link to web OS |
| **Pharmacy staff** (`pharmacy_admin`, `pharmacist`) | Sales/inventory overview, stock alerts, POS via web |
| **Platform admin** | Platform-wide metrics, facility list |

One login (password + email OTP per the current auth doctrine). Today, the **active workspace** is determined by `profiles.role` + `tenant_id`; this is a known limitation. The target is an account/person/membership/workspace model described in the [ecosystem identity contract](../../docs/SYNAPSE_ECOSYSTEM_OPERATING_MODEL_2026.md#7-identity-organizations-tenancy-and-consent).

**API host:** `https://www.synapseos.tech` — always use **www**, never apex. Android drops POST bodies on apex→www redirects.

---

## 2. Architecture & folder structure

```
apps/app/
├── app/                      # expo-router file-based routes
│   ├── _layout.tsx           # Root: fonts, AuthProvider, SafeArea
│   ├── index.tsx             # Auth gate → login or home
│   ├── (auth)/
│   │   ├── _layout.tsx
│   │   └── login.tsx         # Password → email OTP (2-step)
│   ├── (main)/               # Tab navigator (role-aware)
│   │   ├── _layout.tsx       # Dynamic tabs via lib/navigation.ts
│   │   ├── home.tsx          # Role dashboard (API-driven)
│   │   ├── records.tsx       # Patient health timeline
│   │   ├── appointments.tsx  # Upcoming visits / telemed
│   │   ├── meds.tsx          # Medications from health profile
│   │   ├── queue.tsx         # Clinical today's queue
│   │   ├── patients.tsx      # Patient search (staff)
│   │   ├── stock.tsx         # Pharmacy inventory alerts
│   │   ├── profile.tsx       # Account, sign-out, web portal link
│   │   └── settings.tsx      # Redirect → profile (legacy)
│   └── patient/[id].tsx      # Patient chart (staff, stack screen)
├── components/
│   ├── ui/                   # Design-system primitives (Button, Card, Badge…)
│   ├── WorkspaceHeader.tsx   # Facility / role context bar
│   ├── SynapseLogo.tsx
│   └── BrandWordmark.tsx
├── lib/
│   ├── api.ts                # fetch wrapper, www base URL, Bearer token
│   ├── auth.tsx              # AuthProvider, SecureStore session
│   ├── dashboard.ts          # Dashboard API types + fetch
│   ├── navigation.ts         # Role → tab visibility (blueprint §10.4)
│   ├── roles.ts              # Role taxonomy, dashboard kinds
│   └── theme.ts              # Design tokens (03_DESIGN_SYSTEM)
├── assets/                   # icon, splash, adaptive-icon
├── scripts/                  # postinstall metro patch, brand assets
├── app.json                  # Expo config + extra.webAppUrl
├── eas.json                  # EAS build profiles
├── metro.config.js           # Monorepo resolver (SDK 52 isolation)
├── babel.config.js
├── tsconfig.json             # strict, @/* path alias
├── GUIDE.md                  # This file
└── README.md                 # Quick start
```

### Design principles

- **Routes stay thin** — screens call `lib/` and `components/ui/`.
- **Role logic lives in `lib/navigation.ts` + `lib/roles.ts`** — one place to add tabs/journeys.
- **Tokens only** — `lib/theme.ts`; no raw hex in screens.
- **Server-driven dashboard** — `/api/mobile/dashboard` returns stats, lists, quick actions per role.

---

## 3. Auth flow (02_AUTH_DOCTRINE)

Mobile follows the same custom auth model as web:

```
1. POST /api/auth/mobile/login     { email, password }  → sends email OTP
2. POST /api/auth/mobile/otp-verify  { email, otp }       → { token, user }
3. Token stored in expo-secure-store (key: synapse_mobile_token)
4. All API calls: Authorization: Bearer <token>
5. GET  /api/auth/mobile/me        → restore session on app launch
6. POST /api/auth/mobile/logout     → revoke synapse_sessions row
```

- JWT app claim: `mobile`, shorter TTL (3 days).
- Session validated server-side via `synapse_sessions` ledger (revocable).
- **No password-only login** — OTP is mandatory (doctrine §D).

Client: `lib/auth.tsx` → `useAuth()` provides `{ user, token, login, verifyLoginOtp, logout }`.

---

## 4. Role-based journeys & screens

Tabs are chosen by `dashboardKindForRole()` → `TABS_BY_KIND` in `lib/navigation.ts`:

| Dashboard kind | Tabs | Primary features |
|---|---|---|
| **patient** | Home · Records · Visits · Meds · Profile | Health timeline, appointments, medications |
| **clinician / nurse / reception / admin** | Home · Queue · Patients · Profile | Today's queue, patient search, chart detail |
| **pharmacy** | Home · Stock · Profile | Low-stock alerts, inventory summary, web POS link |
| **lab** | Home · Patients · Profile | Pending orders via dashboard quick actions |
| **billing** | Home · Profile | Claims overview via dashboard |
| **generic / platform_admin** | Home · Profile | Platform metrics or generic stats |

**Home dashboard** loads from `GET /api/mobile/dashboard` — stats, alert lists, and quick actions (in-app routes `app:…` or web deep links `web:…`).

---

## 5. Design system (03_DESIGN_SYSTEM)

Implemented in `lib/theme.ts`:

- **Dark default** — canvas `#07070A`, surfaces layered by lightness + 1px borders (no glow shadows).
- **Brand** — orange `#F97316` primary actions; gold `#E8B84B` verified/premium; teal `#1FA6A6` info/clinical accents.
- **Primary button** — orange bg + near-black text (AA contrast on dark).
- **Typography** — DM Sans (400/500/700); monospace for MRN, Synapse ID, amounts.
- **Spacing** — 8pt grid; radii sm=6, md=8, lg=12, xl=16.
- **Status badges** — `StatusBadge` uses clinical colors (red/amber/green/blue), never brand orange for severity.
- **Icons** — `@expo/vector-icons` (Ionicons); no emoji in UI.

When adding screens: import from `@/lib/theme`, use `@/components/ui/*`, left-align content, one primary CTA per section.

---

## 6. API integration

### Base URL

Set in `app.json`:

```json
"extra": {
  "webAppUrl": "https://www.synapseos.tech"
}
```

`lib/api.ts` normalizes apex → www automatically. **Never change to apex.**

### Endpoints

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/mobile/login` | Password verify → send OTP |
| POST | `/api/auth/mobile/otp-verify` | OTP → JWT + user |
| GET | `/api/auth/mobile/me` | Current user |
| POST | `/api/auth/mobile/logout` | Revoke session |
| GET | `/api/mobile/dashboard` | Role dashboard payload |
| GET | `/api/mobile/queue` | Today's clinical queue |
| GET | `/api/mobile/patients` | Patient search (`?q=`) |
| GET | `/api/mobile/patients/:id` | Patient chart |
| GET | `/api/mobile/appointments` | Upcoming visits |
| GET | `/api/mobile/records` | Patient health timeline |
| GET | `/api/mobile/medications` | Medication list |
| GET | `/api/mobile/inventory` | Pharmacy stock alerts |

All mobile routes live under `apps/web/src/app/api/mobile/` and `apps/web/src/app/api/auth/mobile/`.

### Request headers

```
Content-Type: application/json
Accept: application/json
X-App: mobile
Authorization: Bearer <token>   # when authenticated
```

---

## 7. Local development

### Prerequisites

- Node.js 20 LTS+
- npm (monorepo root: `npm install`)
- Optional: Android Studio + emulator, Expo Go app

### Commands

From **repo root**:

```bash
npm install
npm run start --workspace @synapse/app
```

From **`apps/app`**:

```bash
npm start              # Expo dev server
npm run android        # Local native build (requires Android SDK)
npm run type-check     # tsc --noEmit (must pass before ship)
npm run export:android # Bundle export (validates Metro graph)
```

### Path alias

`@/` → `apps/app/` root (see `tsconfig.json`).

### Monorepo note

`metro.config.js` watches the workspace root but resolves `node_modules` from `apps/app` first — prevents hoisted Expo SDK 56 at repo root from breaking SDK 52.

`postinstall` runs `scripts/patch-expo-metro-file-store.mjs` (Windows Metro file-store fix).

---

## 8. EAS build & APK install

EAS builds from **git** — commit and push before building.

### One-time setup

```bash
npm i -g eas-cli    # or: npx eas-cli
eas login
```

Project ID: `app.json` → `extra.eas.projectId` (`547aa81a-9d93-447e-afc3-16f10eee6cb9`).  
Owner: `ebrinejason`.

### Build preview APK

```bash
cd apps/app
git push origin main          # ensure remote has latest commit
npx eas-cli build --platform android --profile preview --non-interactive
```

Profiles in `eas.json`:

| Profile | Output | Use |
|---|---|---|
| `development` | APK + dev client | Local debugging with native modules |
| `preview` | APK | Internal testing / sideload |
| `production` | AAB | Play Store |

Or from repo root: `npm run build:apk --workspace @synapse/app`

### Install APK

1. Open the build URL from EAS CLI output (or [expo.dev](https://expo.dev) → project → Builds).
2. Download the `.apk` on your Android device.
3. Enable "Install from unknown sources" if prompted.
4. Install and open **Synapse**.

### Version bumps

Before each release, increment in `app.json`:

- `expo.version` — user-visible semver
- `expo.android.versionCode` — integer, must increase for Play Store

---

## 9. Troubleshooting

### Login fails / network error

- Confirm device has internet.
- API must be `https://www.synapseos.tech` (www). Apex redirects break Android POST login.
- Check deployed web app has mobile auth routes live.
- Account needs `password_hash` + `email_verified_at` (auth doctrine credential-seed).

### OTP never arrives

- Resend env on Vercel: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`.
- Check spam; OTP expires in minutes — request a new code.

### Session lost on restart

- Token stored in SecureStore. If `/api/auth/mobile/me` returns 401, session was revoked or expired — user must re-login.

### Type-check / export failures

```bash
cd apps/app
npm run type-check
npm run export:android
```

Fix TypeScript errors before EAS build. Common issues: missing screen files referenced in `_layout.tsx`, wrong `@/` imports.

### EAS build fails

- **Not committed:** EAS clones git — push your commit first.
- **Wrong SDK:** Ensure build runs from `apps/app` with Expo 52 lockfile.
- **Windows PATH:** Use `npx eas-cli` if global `eas` not found.
- Check build logs on expo.dev for Gradle/SDK errors.

### Empty dashboard / no data

- Expected for new tenants (0 encounters, 0 sales). Dashboard shows empty states; pull to refresh.
- Pharmacy needs products in `pharmacy_products` for stock tab.
- Patient records need `patient_profiles` row linked to profile id.

### Push notifications not arriving

- Must be a **physical device** (Expo push tokens are not issued on most emulators).
- Grant notification permission on first login after install.
- Confirm `mobile_push_tokens` has a row for your user after login.
- Server triggers: bulletin publish, new encounter/queue, stock below reorder, nightly `/api/cron/mobile-alerts` (appt +7d expiry).
- Cron requires `CRON_SECRET` on Vercel.

### Metro monorepo conflicts

If wrong Expo/Metro version resolves, verify `metro.config.js` has `disableHierarchicalLookup: true` and app-local `node_modules`.

---

## 10. APK smoke-test checklist

Use a preview APK (`eas build --profile preview`) on a real Android device.

### Setup
- [ ] Install APK; open Synapse; grant notifications when prompted
- [ ] Confirm API host is `https://www.synapseos.tech` (see login errors if apex)
- [ ] Login with password + email OTP for each role you care about

### Patient
- [ ] Home dashboard loads (or empty state)
- [ ] Records / Visits / Meds tabs visible; tap → detail screens open
- [ ] Background app >5 min → Lock screen → biometric/passcode unlock
- [ ] Publish a platform bulletin → push arrives → tap opens Home

### Clinician / nurse / reception
- [ ] Queue + Patients tabs visible
- [ ] Create OPD triage / encounter on web → push “New patient in queue” → tap opens Queue
- [ ] Queue row → encounter detail; “Open full chart” deep-links to web OS if shown

### Pharmacy
- [ ] Stock tab visible; item detail opens
- [ ] Lower qty below reorder (portal stock adjust or POS sale) → push → tap opens Stock
- [ ] Product with expiry ≤7 days → after cron `mobile-alerts` (or manual GET with `CRON_SECRET`) → expiry push

### Lab / billing roles
- [ ] Lab tab lists orders (or empty); Claims tab for billing roles
- [ ] `POST /api/lab/notify` with linked patient profile → patient gets “Lab result ready”

### Regression
- [ ] Sign out clears session; relaunch shows login
- [ ] Wrong password / wrong OTP handled without crash
- [ ] Airplane mode → cached home (if previously loaded) or clear error, no white screen

---

## 11. Adding a new role or screen

1. Add role → kind mapping in `lib/roles.ts`.
2. Add tab list in `lib/navigation.ts` → `TABS_BY_KIND`.
3. Create screen file under `app/(main)/`.
4. Register in `app/(main)/_layout.tsx` with `href: tabHref(role, 'yourtab')`.
5. If dashboard data needed, extend `apps/web/src/app/api/mobile/dashboard/route.ts`.
6. Run `npm run type-check` && `npm run export:android`.

---

## 12. Related docs

| Doc | Topic |
|---|---|
| `01_MASTER_BLUEPRINT.md` | Identity model, journeys, subdomain architecture |
| `02_AUTH_DOCTRINE.md` | Login, sessions, OTP, host↔tenant guard |
| `03_DESIGN_SYSTEM.md` | Tokens, components, mobile tab spec §10.4 |
| `06_ECOSYSTEM_REFERENCE.md` | Module inventory, what exists in DB |
| `07_JOURNEY_AND_ROADMAP.md` | Patient/pharmacy/hospital journeys, gaps |
| `docs/superpowers/specs/2026-06-22-mobile-app-improvements-design.md` | Mobile improvement plan + status |

---

*Synapse Health Technologies · Kampala, Uganda*
