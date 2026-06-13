# Build Doctrine Status — 2026-06-13

> Ground truth scan of Synapse OS platform. Updated each phase.

---

## Branch
`feat/pharmacy-migration` — current build: `26dc0f5` (Vercel QUEUED)

---

## Auth Paths (synapse_session minting)

| Route | Mints synapse_session | Notes |
|---|---|---|
| `POST /api/auth/password-login` | YES | web + mobile apps |
| `POST /api/auth/email-otp/verify` | YES | OTP login |
| `POST /api/auth/mfa/verify` | YES | TOTP second factor |
| `POST /api/auth/mfa/verify-setup` | YES | TOTP enrollment |
| `GET /api/auth/callback` | YES (via /api/auth/welcome) | OAuth + magic link |
| `POST /api/auth/mobile/login` | YES (token in body, no cookie) | Expo app |
| `POST /api/auth/phone/verify` | PARTIAL | phone OTP — needs verification |
| `POST /api/auth/logout` | N/A — revokes | revokeSession + Supabase signOut |
| `POST /api/auth/mobile/logout` | N/A — revokes | token in header |

**Pharmacy app auth** (`apps/pharmacy`):
| Route | Status |
|---|---|
| `POST /api/auth/login` | Uses Supabase Auth + `pharmacy_user_settings` role check — does NOT mint synapse_session (separate app, acceptable for Phase 1) |
| `GET /api/auth/session` | Reads Supabase session |

---

## Environment Variables

### Set on Vercel preview (feat/pharmacy-migration) — CONFIRMED
- `SYNAPSE_JWT_SECRET` ✓
- `NEXT_PUBLIC_SUPABASE_URL` ✓
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` ✓
- `SUPABASE_SERVICE_ROLE_KEY` ✓
- `GEMINI_API_KEY` ✓
- `NEXT_PUBLIC_APP_URL` ✓
- `ADMIN_EMAILS` ✓
- `RESEND_API_KEY` ✓
- `RESEND_FROM_EMAIL` ✓
- `TWILIO_ACCOUNT_SID` ✓
- `TWILIO_AUTH_TOKEN` ✓
- `TWILIO_PHONE_NUMBER` ✓

### Referenced in code but NOT confirmed set
- `AFRICAS_TALKING_API_KEY` — SMS fallback
- `AFRICAS_TALKING_SENDER_ID` — SMS fallback
- `DEEPSEEK_API_KEY` — AI
- `DHIS2_URL` — DHIS2 integration
- `FLUTTERWAVE_SECRET_KEY` — payments
- `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` — telemedicine
- `NEXT_PUBLIC_LIVEKIT_URL` — telemedicine
- `NEXT_PUBLIC_APK_DOWNLOAD_URL` — mobile
- `NEXT_PUBLIC_PHARMACY_APP_URL` — pharmacy app URL
- `OPENROUTER_API_KEY` — AI fallback
- `PLATFORM_MRR_TARGET_UGX` — revenue dashboard
- `SYNAPSE_PHARMACY_VERCEL_PROJECT_ID` — domain provisioning
- `SYNAPSE_VERCEL_PROJECT_ID` / `SYNAPSE_VERCEL_TEAM_ID` — Vercel API
- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` — rate limiting/caching
- `VERCEL_API_TOKEN` / `VERCEL_PROJECT_ID` / `VERCEL_TEAM_ID` / `VERCEL_TOKEN` — Vercel API

---

## Supabase Tables

### Referenced in apps/web code (81 unique tables)
ai_call_logs, ai_health_chats, apk_waitlist, attendance_records, audit_log, audit_logs, auth_otps, beds, beta_access_requests, billing_invoices, billing_payments, capabilities, departments, device_readings, dhis2_export_log, diet_logs, dispense_requests, drug_inventory, encounter_diagnoses, encounter_orders, encounters, facility_subscriptions, feature_flags, habit_logs, health_bulletins, health_habits, hospital_beds, hospital_leads, hospital_modules, hospitals, import_batch_rows, import_batches, insurance_benefits, insurance_claims, insurance_copilot_audit, insurance_coverage_checks, insurance_policies, insurance_preauthorizations, inventory_items, invoices, lab_results, lab_test_results, medical_devices, menstrual_cycles, mfa_enrollments, newsletter_subscribers, patient_clinical_patterns, patient_intervention_outcomes, patient_profiles, patients, payments, pharmacy_network_inventory, pharmacy_onboarding, pharmacy_products, pharmacy_profiles, pharmacy_user_settings, phi_access_log, prescriptions, professional_leads, profiles, reasoning_actions, reasoning_audit, reasoning_context_snapshots, reasoning_evidence, reasoning_evidence_impact, reasoning_hypotheses, reasoning_sessions, role_capabilities, staff_shifts, subscription_plans, support_ticket_events, support_tickets, surveillance_reports, sync_conflicts, telemedicine_appointments, telemedicine_intake_cases, telemedicine_intake_messages, telemedicine_providers, telemedicine_soap_notes, tenant_subscriptions, tenants, verification_documents, vitals

### Tables needed by Build Doctrine not yet confirmed existing
- `subscription_plans` — Phase 3 (Subscriptions)
- `tenant_subscriptions` — Phase 3 (Subscriptions)
- `plan_features` — Phase 3 (feature gates)
- `facility_applications` — Phase 4 (Onboarding)
- `onboarding_payments` — Phase 4
- `custom_domain_requests` — Phase 4

---

## Packages

| Package | Path | Purpose |
|---|---|---|
| `@synapse/auth` | packages/auth | JWT, session, capability |
| `@synapse/config` | packages/config | Constants (SESSION_COOKIE etc.) |
| `@synapse/db` | packages/db | Supabase client helpers |
| `@synapse/email` | packages/email | Email sending |
| `@synapse/ui` | packages/ui | Shared UI components |

---

## Build Doctrine Phase Status

| Phase | Name | Status | Notes |
|---|---|---|---|
| 0 | Discovery Scan | ✅ DONE | This document |
| 1 | Auth Convergence | ✅ DONE | All login paths mint synapse_session; all bugs fixed (8 critical, commit 3127366 + 26dc0f5) |
| 2 | Lattice Extension | 🔲 TODO | Add capabilities for pharmacy, POS, insurance domains |
| 3 | Subscriptions & Feature Gates | 🔲 TODO | subscription_plans, plan_features, tenant_subscriptions, has_feature() |
| 4 | Onboarding & Billing | 🔲 TODO | facility_applications, onboarding_payments, custom_domain_requests |
| 5 | Hospital OS | 🔲 TODO | Core ward/OPD/inpatient flows |
| 6 | Facility Ranking | 🔲 TODO | Public facility ranking/discovery |
| 7 | Pharmacy POS | 🚧 IN PROGRESS | apps/pharmacy exists, POS API exists, FEFO + dispensing needed |
| 8 | Insurance Copilot | 🔲 TODO | AI-assisted claim pre-auth |
| 9 | Longitudinal Intelligence | 🔲 TODO | Patient pattern analysis |
| 10 | Patient App | 🔲 TODO | Health app for patients |
| 11 | Emergency | 🔲 TODO | A&E, ambulance dispatch |
| 12 | Migration Wizard | 🔲 TODO | CSV/XLSX bulk migration tool |
| 13 | Bulletins | 🔲 TODO | Health bulletins / comms |
| 14 | Revenue | 🔲 TODO | Revenue dashboard, billing |
| 15 | Theme | 🔲 TODO | Theming/branding per tenant |
| 16 | RLS Hardening | 🔲 TODO | Audit all RLS policies |

---

## Pharmacy Ship It Status (Priority Track)

| Phase | Name | Status | Notes |
|---|---|---|---|
| 1 | Admin enrolls pharmacy | 🚧 IN PROGRESS | `POST /api/platform/pharmacies` exists + auth-guarded; invite email sends via Resend; `pharmacy_onboarding` row created |
| 2 | Invite → login → 3-step onboarding | 🔲 TODO | `apps/pharmacy/app/invite/[token]/` and `apps/pharmacy/app/onboarding/` exist — need to verify flow completeness |
| 3 | Inventory | 🔲 TODO | `POST /api/admin/inventory/bulk-upload` exists — need CSV/XLSX parse + batch tracking |
| 4 | POS counter + FEFO | 🔲 TODO | `POST /api/admin/pos/transaction` exists — need FEFO decrement + human-confirm gate |
| 5 | Dashboard | 🔲 TODO | `GET /api/admin/dashboard` exists — need UI |
| 6 | Deploy + verify | 🔲 TODO | After above phases pass |

---

## Apps Overview

### apps/web (310 routes total)
- Marketing/public: `/`, `/pricing`, `/features`, `/about`, `/blog`, etc.
- Hospital OS: `/os/[slug]/*`, `/admin/*`, `/doctor/*`, `/nurse/*`, `/patient/*`
- Platform admin: `/platform/*`
- Specialty depts: `/dept/*`
- Auth: `/login`, `/signup`, `/invite/[token]`, `/forgot-password`, `/reset-password`
- Pharmacy (legacy): `/pharmacy/*` (old pages — superseded by apps/pharmacy)

### apps/pharmacy (49+ routes)
- Auth: `/login`, `/invite/[token]`, `/auth/2fa`, `/change-password`
- Onboarding: `/onboarding`
- Tenant portal: `/[tenantSlug]/*`
- Customer: `/customer/*`
- Admin APIs: `/api/admin/*` (inventory, POS, orders, staff, reports)
- Auth APIs: `/api/auth/*`
