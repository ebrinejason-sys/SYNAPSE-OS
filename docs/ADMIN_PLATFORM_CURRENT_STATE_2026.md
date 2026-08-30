# SYNAPSE Platform Admin — Current State Audit (2026-08-29)

**Surface:** https://admin.synapseos.tech → `apps/web` `/platform/*`  
**Repo SHA at audit:** `e87e8f8` (`main`)  
**Principle:** Do not redesign. Classify what exists. Evidence over assumption.  
**Related specs:** `docs/architecture/platform-control-plane.md`, `docs/superpowers/specs/2026-07-14-platform-admin-control-plane-design.md`

---

## Executive verdict

`admin.synapseos.tech` is a **real growth/ops shell with genuine tenant, pharmacy, billing, support, and audit data** — not a decorative mock. It is **not** yet a production control plane for the whole SYNAPSE ecosystem.

| Question | Answer today |
|---|---|
| Can an operator see ecosystem readiness with evidence? | **No** — missing Product Registry, Test Center, capability gates UI, release/deploy SHA drift |
| Can they safely test interconnected modules without risking production? | **No** — Simulation Lab / Golden Journeys / synthetic tenant isolation not built |
| Can they determine why a module is not production-ready? | **No** — capability registry is JSON/docs only; admin cannot show Lab/AI/FHIR scorecards |
| Is authorization production-grade? | **Partial** — binary `platform_admin` + login MFA; no least-privilege roles; no step-up MFA on mutations |

**Overall admin maturity: PARTIAL.**

---

## Legend

| Class | Meaning |
|---|---|
| OPERATIONAL | Real auth, real data, mutations work, usable in production for its stated job |
| PARTIAL | Useful but incomplete, mixed real/synthetic, missing audit, or weak probes |
| MOCK | Renders status/metrics without backing evidence (env-as-health, hardcoded panels) |
| PLACEHOLDER | “Coming soon” / empty shell |
| DEVELOPMENT | Experimental / incomplete wiring |
| BROKEN | Route or data model mismatch that fails its intended job |
| SECURITY_RISK | Works but violates control-plane safety expectations |
| DEPRECATED | Redirect / legacy alias |

---

## 0. Navigation vs aspirational surfaces

Canonical nav: `apps/web/src/app/platform/layout.tsx` → `SIDEBAR_SECTIONS`.

**Live sidebar (19 items):** every href has a `page.tsx`. No broken nav links.

| Expected control-plane surface | Status |
|---|---|
| Command Center | Exists — `/platform` |
| Applications, Approvals, Sales, Facilities, Users | Exist |
| Pharmacies, Support, Broadcasts | Exist |
| Billing, Receipts | Exist |
| Analytics, SynapseEPI | Exist |
| Security, Audit, Feature Flags, DHIS2, Settings | Exist |
| Speed Insights | **Mislabel** — nav → `/platform/health` (standing audit + mock health API), not Vercel Speed Insights console |
| Product Registry | **Missing** |
| Service Health (dedicated) | **Missing** (partial overlap with `/platform/health`) |
| Simulation Lab | **Missing** |
| Event Explorer | **Missing** |
| Module Matrix | **Missing** (facility modules only on broken hospital detail) |
| Integrations page | **Missing** (env checklist subsection inside Settings) |
| Incidents | **Missing** |
| Database control center | **Missing** (DB latency KPI on Command Center only) |
| Deployments | **Missing** |
| Mobile Builds | **Missing** |
| Test Center / Releases / Capabilities / Intelligence / FHIR / ICD-11 / Lab monitors | **Missing** |

Earlier narrative that “the admin already has Product Registry, Simulation Lab, Event Explorer…” describes **design intent / consolidated docs**, not the live `SIDEBAR_SECTIONS` tree. The shell is broad for **growth + pharmacy ops**; the **engineering/test/release control plane is largely absent**.

---

## 1. Authorization & identity (cross-cutting)

### What exists

| Piece | Location | Reality |
|---|---|---|
| `requirePlatformAdmin` | `apps/web/src/lib/platform/auth.ts` | Live profile via `getContext`; allows `platform_admin` **or** `ADMIN_EMAILS` |
| Admin subdomain middleware | `apps/web/src/middleware.ts` | Session + role/email gate; rewrites to `/platform` |
| MFA at login | `packages/auth` MFA routes | TOTP required for `role === platform_admin` before session |
| Capability bypass | `packages/auth/src/capability.ts` | `platform_admin` bypasses all tenant capabilities |
| Impersonation API | `apps/web/src/app/api/platform/impersonate` | Audited; cannot target platform_admin/superadmin |

### Gaps vs production control plane

| Gap | Severity |
|---|---|
| **Binary god-role** — no SUPER_ADMIN / BILLING_ADMIN / READ_ONLY_AUDITOR scopes | High |
| **MFA is login-only** — JWT has no MFA/AAL claim; mutations do not step-up | High |
| **`/api/*` skipped by middleware** — each route must self-authorize | High |
| Several `/api/platform/*` use `getCurrentUser` JWT role **without DB role refresh** | High |
| `ADMIN_EMAILS` can grant UI access **without** `platform_admin` and **without** MFA path | High |
| Client layout does not gate; relies on middleware + per-page `requirePlatformAdmin` | Medium |
| Service-role (`supabaseAdmin`) used for platform data — RLS is not a backstop | Medium (by design if app auth is perfect; dangerous if not) |
| UI copy claims “MFA assurance / aal2” that code does not enforce | Medium integrity risk |
| Audit fail-open (`logPlatformEvent` swallows insert errors) | Medium |
| No four-eyes approval workflow for HIGH/CRITICAL mutations | High vs spec |

### API inventory (`apps/web/src/app/api/platform/*`)

| Route | Auth pattern | Notes |
|---|---|---|
| `impersonate` | `requirePlatformAdmin` | Audited |
| `billing/export` | `requirePlatformAdmin` | Redirect-on-fail awkward for API |
| `hospitals` GET/POST | JWT `platform_admin` via `getCurrentUser` | No ADMIN_EMAILS; no live DB role re-check |
| `pharmacies` GET/POST | same | High-impact provisioning |
| `security/unlock` | same | Account unlock |
| `health` | DB role re-check | Better; returns mixed real/hardcoded payload |
| `search` | DB role re-check | `q` interpolated into PostgREST `.or()` — filter-abuse risk |

---

## 2. Per-route classification

### Overview

| Route | Class | Backing | Mutations | Audit | Auth | Notes |
|---|---|---|---|---|---|---|
| `/platform` Command Center | **PARTIAL** | Real counts: `tenants`, `profiles`, `synapse_sessions`, `verification_documents`, `support_tickets`, `hospital_leads`, `pharmacy_pos_sales`, `tenant_subscriptions`, `audit_log`, … | None | Reads audit | `requirePlatformAdmin` | **Real ops cards.** Health strip: Auth/Email/Payments/Deploy = **env presence** (MOCK anti-pattern). MRR sparkline synthetic. `safeCount` failures → `0` (hides errors). Only DB latency is a real probe. |
| `/platform/login` | OPERATIONAL | Auth APIs | Login | Auth system | Public | — |
| `/platform/mfa`, `/mfa-verify` | OPERATIONAL | MFA APIs | Enroll/verify | Auth | Pending cookie | — |

### Growth

| Route | Class | Backing | Mutations | Audit | Notes |
|---|---|---|---|---|---|
| `/platform/applications` | OPERATIONAL | `hospital_leads`, `professional_leads` | Status updates | **Missing** | Real pipeline |
| `/platform/approvals` | PARTIAL | leads + `verification_documents` + `profiles` | Approve/reject | **Missing** | KYC may update profile without document status sync |
| `/platform/sales` | OPERATIONAL | `hospital_leads` | create/update stage | **Missing** | Real kanban |
| `/platform/hospitals` | OPERATIONAL | `tenants` + subscriptions/flags | Suspend/extend/reactivate | Yes (subscription-actions) | List is tenant-based |
| `/platform/hospitals/[id]` | **BROKEN** | Queries `hospitals` / `hospital_modules` | None | N/A | List links tenant IDs → detail expects `hospitals` row. Module matrix incomplete. |
| `/platform/hospitals/new` | PARTIAL / SECURITY_RISK* | POST `/api/platform/hospitals` | Yes | Partial | *Page itself has no `requirePlatformAdmin` (API must gate). Silent `catch {}` on secondary inserts; provisioning incomplete vs control-plane spec. |
| `/platform/users` | OPERATIONAL | `profiles`, `verification_documents` | Password reset | Yes | KYC display; approve elsewhere |

### Operations

| Route | Class | Backing | Mutations | Audit | Notes |
|---|---|---|---|---|---|
| `/platform/pharmacy-network` | **OPERATIONAL** (strongest ops surface) | `tenants`, `pharmacy_profiles`, `pharmacy_onboarding` | Status, domain, delete, … | Yes | Prefer domain-approved ops; do not add generic inventory edits |
| `/platform/pharmacies/onboard` | OPERATIONAL / PARTIAL | POST `/api/platform/pharmacies` | Yes | API logs | Page ungated RSC; API-gated mutations |
| `/platform/support` | OPERATIONAL | `support_tickets`, events | Assign/status | Yes | No create-ticket UI |
| `/platform/broadcasts` | PARTIAL | `health_bulletins`, push/email/SMS | Publish + send | Email/SMS yes; bulletin insert **no** | — |

### Money

| Route | Class | Backing | Mutations | Audit | Notes |
|---|---|---|---|---|---|
| `/platform/billing` | OPERATIONAL | subscriptions, invoices, payments | Plan/invoice/mark paid | Yes | Dual models: `facility_subscriptions` vs `tenant_subscriptions` |
| `/platform/receipts` (+ CRUD) | OPERATIONAL | `platform_billing_documents` | Full CRUD | Yes | — |

### Intelligence

| Route | Class | Backing | Mutations | Audit | Notes |
|---|---|---|---|---|---|
| `/platform/analytics` | OPERATIONAL / PARTIAL | Pharmacy-skewed real counts | None | Read-only | Not full ecosystem scoreboard |
| `/platform/public-health` | PARTIAL | `diagnoses`, `dhis2_export_log`, `surveillance_reports` | Publish button **inert** | N/A | Aggregate only (good); naïve outbreak heuristic |

### System

| Route | Class | Backing | Mutations | Audit | Notes |
|---|---|---|---|---|---|
| `/platform/security` | OPERATIONAL | locked profiles, filtered `audit_log` | Unlock API | Unlock audited | No step-up MFA |
| `/platform/audit-log` | OPERATIONAL | `audit_log` (fallback `audit_logs`) | None | Is the ledger | CSV export stub; dual-table ambiguity |
| `/platform/flags` | PARTIAL | `feature_flags` | Upsert | Writes **wrong table** `audit_logs` / `actor_id` | Matrix limited to first 10 tenants |
| `/platform/dhis2` | PARTIAL / MOCK mutations | `dhis2_export_log`; connection = env URL | Insert pending rows / “retry” | Yes | Does **not** call DHIS2; must not claim GREEN |
| `/platform/health` (“Speed Insights”) | PARTIAL + MOCK pockets | Real standing-audit counts + `/api/platform/health` | None | N/A | API hardcodes `rlsCoverage: "134/134"`, `dbSize: "-"`, env-as-Vercel/Resend |
| `/platform/settings` | PARTIAL | Env readiness only | Maintenance button **dead** | N/A | No secrets revealed (good); no structured settings store |

### Aliases / stubs / extras

| Route | Class | Notes |
|---|---|---|
| `/platform/feature-flags` | DEPRECATED | → `/platform/flags` |
| `/platform/system/health` | DEPRECATED | → `/platform/health` |
| `/platform/tenants` | DEPRECATED | → `/platform/hospitals` |
| `/platform/tenants/provision` | DEPRECATED | → `/platform/pharmacies/onboard` |
| `/platform/tenants/[id]` | PARTIAL | Pharmacy-ish tenant detail; UI incomplete vs impersonate/resend design |
| `/platform/guidelines` | PLACEHOLDER | “Coming soon”; not in nav |
| `/platform/system/settings` | PLACEHOLDER | “Coming soon” |
| `/platform/account` | PARTIAL | No `requirePlatformAdmin` in page; not in sidebar |

---

## 3. Missing control-plane capabilities (not built)

These are required by the Production Control Plane milestone and have **no** `/platform` route today:

1. Product Registry (evidence-linked products, SHAs, URLs, blockers)
2. Engineering / project registry (epics ↔ PR ↔ CI ↔ deploy)
3. Deployment Control Center (Vercel server-side)
4. Environment configuration health (configured boolean, last verified — no secret values)
5. Release Control Center
6. Capability Gate Center (UI over `docs/implementation/capability-registry.json` + `packages/config`)
7. **Universal Test Center** (+ Golden Journeys)
8. Simulation Lab 2.0 + external system fault injection
9. Event Explorer (correlation/causation chains)
10. Synapse Exchange / FHIR / ICD-11 / Intelligence / Lab / Insurance control centers
11. Incidents (SEV workflow)
12. Database metadata center (no arbitrary SQL)
13. Migration registry + approval
14. Mobile Builds (EAS) + GitHub CI observability
15. Runtime log view (redacted)
16. Notification center / maintenance mode / DR metadata view
17. Support sessions (extend impersonation safely — design exists in architecture doc)
18. Module quality scoreboard / production readiness scorecard

---

## 4. Data plane vs control plane boundary (today)

| Behavior | Status |
|---|---|
| Platform uses service role for ops tables | Yes — intentional; must stay tightly authorized |
| Unrestricted clinical PHI browser | Not present as a product feature (good) |
| Aggregate public-health views | Present on SynapseEPI |
| Impersonation into pharmacy tenant | Exists — needs SUPPORT SESSION model (reason, expiry, default read-only) |
| Admin prescribing / lab verify / inventory qty edit | Not exposed as generic tools (preserve this) |
| Synthetic tenant isolation (`is_synthetic`, demo filters on egress) | **Not implemented** as first-class guarantee |

---

## 5. Evidence sources that already exist (extend, don’t replace)

| Asset | Path | Admin wiring |
|---|---|---|
| Capability registry | `docs/implementation/capability-registry.json` | **Not surfaced in UI** |
| Capability status helpers | `packages/config/src/capability.ts` | Helpers only |
| Pharm release readiness | `docs/release/SYNAPSE_PHARM_PRODUCTION_READINESS.md` | Not linked from admin |
| Control-plane architecture | `docs/architecture/platform-control-plane.md` | Spec ahead of code (sandbox hospital, support sessions, real monitoring) |
| Sync / inventory RPCs | `packages/db`, supabase migrations | Pharmacy domain — monitor only from admin |
| Interop packages | `packages/interop/*` | No Exchange control center |
| Vercel domains helper | `apps/web/src/lib/vercel-domains.ts` | Domain provisioning only — **not** deployments list |
| EAS / Expo | `apps/app/eas.json` | No Mobile Builds UI |
| CI workflows | `.github/workflows/*` | No GitHub observability UI |

---

## 6. Production dependencies & env (observed patterns)

Admin “health” currently treats many of these as **configured vs missing**, not **working**:

- `NEXT_PUBLIC_SUPABASE_URL` / keys
- `RESEND_*`
- payment provider keys
- `VERCEL_TOKEN` (presence only)
- `DHIS2_URL`
- `ADMIN_EMAILS`
- AI keys (`GEMINI_*`, OpenRouter, etc.) — settings checklist / env, not live probe + latency + error rate

**Rule going forward:** CONFIGURED ≠ HEALTHY. Require recent successful probe evidence.

---

## 7. Tests & CI gaps

| Expectation | Today |
|---|---|
| `npm run verify:platform-admin` | **Does not exist** |
| Unauthenticated `/platform` blocked | Middleware + page gates (admin host); needs automated proof |
| Least-privilege RBAC tests | **N/A** — roles don’t exist |
| MFA required for mutations | **Fails** expectation |
| High-risk mutation → audit entry | **Inconsistent** |
| Simulation cannot touch production | **N/A** — no Simulation Lab |
| Operator smoke doc | **Missing** (`docs/testing/PLATFORM_ADMIN_PRODUCTION_SMOKE.md`) |

---

## 8. Classification summary counts

| Class | Approx (existing pages) |
|---|---|
| OPERATIONAL | ~14 |
| PARTIAL | ~12 |
| PLACEHOLDER | 2 |
| DEPRECATED / redirect | 4 |
| BROKEN | 1 (`/platform/hospitals/[id]`) |
| MOCK pockets | Command Center env health, health API panel, DHIS2 “export” queue, synthetic sparklines |
| Missing milestone surfaces | **10+** core control-plane pages |

---

## 9. Top security / integrity findings (priority)

1. No fine-grained platform RBAC; one admin = full god mode  
2. MFA not bound to session/mutations  
3. JWT-role trust on high-impact provisioning/unlock APIs  
4. `ADMIN_EMAILS` bypasses MFA path  
5. Env-as-Operational and hardcoded RLS coverage displayed as fact  
6. Audit gaps + wrong audit table on feature flags  
7. Facility list/detail table mismatch (BROKEN)  
8. Impersonation without SUPPORT SESSION constraints  
9. Errors collapsed to zero counts (`safeCount`)  
10. No four-eyes for suspend tenant / flag / credentials / migration-class actions  

---

## 10. Recommended implementation waves (locked)

Do **not** attempt as one commit. Extend existing routes; add missing ones only where nav/spec requires.

| Wave | Focus | First concrete outcomes |
|---|---|---|
| **A** | Security / RBAC / MFA session assurance / audit completeness / API auth unification | Scopes + roles; step-up on HIGH; fix flags audit; fix hospital detail; close JWT-only APIs |
| **B** | Product Registry + Deployments + GitHub + env config health | SHA drift visible (main vs production vs preview) |
| **C** | Universal Test Center + Simulation Lab 2.0 + Golden Journeys | Malaria journey + correlation ID + evidence records |
| **D** | Exchange / FHIR / ICD-11 / Intelligence observability | Provider health ≠ key exists |
| **E** | Lab / Pharm / Insurance / Public Health monitors | Scorecards with PASS/FAIL/NOT_CONFIGURED |
| **F** | Release Control + capability gates UI + readiness scorecard | No manual GREEN |
| **G** | Incidents / support sessions / billing CS polish | SEV workflow; audited support access |
| **H** | Red-team / `verify:platform-admin` / production smoke | Honest delivery report |

---

## 11. Immediate next actions (after this audit)

1. **Wave A kickoff** — authorize every `/api/platform` mutation with live DB role + MFA assurance; introduce capability scopes schema (even if initially mapped 1:1 to `platform_admin`).  
2. **Fix BROKEN** `/platform/hospitals/[id]` to read `tenants` consistently.  
3. **Kill MOCK health** — replace env “Operational” chips with `OPERATIONAL | DEGRADED | NO_TELEMETRY | NOT_CONFIGURED`.  
4. **Scaffold** `/platform/test-center` + `/platform/products` behind auth (empty evidence model first, no fake PASS).  
5. Create `docs/PLATFORM_ADMIN_ARCHITECTURE.md` from this audit + control-plane spec (Wave A docs).

---

## 12. Honesty clause

This document does **not** claim admin.synapseos.tech is production-grade.  
It claims: **the shell and several ops surfaces are real; the ecosystem control plane and Universal Test Center are not yet built; authorization must be hardened before expanding blast radius.**

Final success tests remain unanswered until evidence exists:

1. Can I open admin and determine with evidence whether every important piece of SYNAPSE is working? → **Not yet.**  
2. Can I safely test the interconnected system without risking real patient/facility data? → **Not yet.**  
3. Can I determine exactly why a module is not production-ready? → **Not yet** (JSON registry exists; admin cannot answer).

---

## 13. Wave A–D progress (2026-08-29)

### Wave A (security / API auth)

| Change | Status |
|---|---|
| `requirePlatformAdminApi()` — live profile gate, JSON 401/403 | Done |
| `/api/platform/{hospitals,pharmacies,security/unlock,health,search}` use live DB role | Done |
| `/platform/hospitals/[id]` reads `tenants` (list/detail mismatch fixed) | Done |
| Feature flags write canonical `audit_log` via `logPlatformEvent` | Done |
| Command Center + health API stop claiming env presence = OPERATIONAL | Done |
| Nav label “Speed Insights” → “Platform Health” | Done |
| Platform search uses `.ilike` (no raw `.or()` interpolation) | Done |
| Fine-grained RBAC roles / MFA session assurance / four-eyes | **Not started** |

### Wave B–D (today — production truth + test center)

| Change | Status |
|---|---|
| `apps/web/src/lib/platform/production-truth.ts` — GitHub SHA, process SHA, Vercel deployments, DB latency, OpenRouter models probe, ICD-11 cache/WHO probe, manifest module readiness | Done |
| Command Center **Production truth** panel with linked cards | Done |
| `/api/platform/health` includes production-truth probes; RLS stays `NO_TELEMETRY` | Done |
| `/platform/test-center` + malaria golden journey API | Done |
| `/platform/icd11` + `/api/platform/icd11/probe` | Done |
| `/platform/intelligence` + synthetic malaria eval via `buildRecommendation` | Done |
| Nav: Test Center, Intelligence, ICD-11 | Done |
| `docs/PLATFORM_TEST_CENTER.md` | Done |
| `platform_test_runs` DB migration | **Optional / not applied** — in-memory + audit_log used |
| Fine-grained RBAC / four-eyes | **Not started** |

**Blocked without tokens:** GitHub main SHA (`GITHUB_TOKEN`), Vercel deployment list (`VERCEL_TOKEN` + `VERCEL_PROJECT_ID`), OpenRouter HEALTHY (`OPENROUTER_API_KEY` + live models endpoint), WHO ICD-11 live search (`WHO_ICD_CLIENT_ID` + `WHO_ICD_CLIENT_SECRET`). Local ICD-11 cache works without WHO credentials.