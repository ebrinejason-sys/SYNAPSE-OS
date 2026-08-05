# Synapse Health OS — Target Architecture

Companion to `docs/current-state/2026-08-synapse-integrated-audit.md`. This document
describes the target architecture for the integrated healthcare OS and the invariants
every phase must respect. It is a **design reference**; see
`docs/release/implementation-status.md` for what is actually built.

## 1. Product surfaces & shared spine
- **Platform control plane** — web only, served on `admin.synapseos.tech` (route `/platform`).
- **Hospital OS** — web (`apps/web`), per-tenant HMIS.
- **Synapse Pharm** — pharmacy web portal (`apps/pharmacy`) **and** a fully-native Expo app
  (`apps/app`) that must perform all ordinary pharmacy work without opening the web portal.
- **Citizen / health-worker app** — Expo (`apps/app`).
- **Shared spine** — `@synapse/auth` (custom JWT sessions, capabilities, feature gating),
  `@synapse/db` (Supabase clients, generated types, audit, and the new pure inventory domain),
  `@synapse/config`, `@synapse/email`, `@synapse/ui`.

All mobile traffic flows through `apps/web` `/api/mobile/**` (a BFF); the Expo app never
talks to Supabase directly. This is the correct place to add the missing native-pharmacy
endpoints (reports, refunds, suppliers, users, settings, receipts) — see
`docs/architecture/pharmacy-native-mobile.md`.

## 2. Non-negotiable invariants
1. **Tenant isolation is server-side.** Every query is scoped by the JWT `tenant_id`; RLS is
   defence-in-depth. The service-role client is used only in server routes.
2. **Batch inventory is authoritative for sellable medicine.** `product.quantity` is a hint;
   `sellableQuantity` (active, in-date batches) is the truth. (Phase 1.)
3. **Additive, reversible migrations.** Never recreate live objects; guard with
   `IF NOT EXISTS` / `CREATE OR REPLACE`; document rollback.
4. **No fake surfaces.** No mock buttons, dead screens, fake analytics, or "coming soon"
   actions. Incomplete work is documented, not simulated.
5. **Synthetic data only** for demos/tests; synthetic tenants can never reach real DHIS2,
   EFRIS, NIRA or messaging integrations.
6. **AI is evidence-grounded and clinician-controlled.** No LLM is the database or the
   decision-maker; no final clinical code is auto-assigned; no training on production PHI by default.
7. **Structured errors, never silent failures.** DB/domain errors return machine-readable
   codes and are logged without PHI.

## 3. Data-of-record strategy (critical)
The core pharmacy POS/inventory tables live only in the live DB (see audit §3). Until they are
captured in checked-in migrations, all schema work must be additive and confirmed against the
live schema before apply. A follow-up hardening task should **snapshot the live pharmacy DDL
into a baseline migration** so the repo can be rebuilt reproducibly.

## 4. Module map (target)
| Domain | Home | Status |
|--------|------|--------|
| Pharmacy inventory authority | `@synapse/db` inventory domain + SQL view/RPC | **Phase 1 built** |
| Native pharmacy app | `apps/app` + `apps/web` mobile BFF | design (Phase 2–3) |
| Receipt domain service | `@synapse/db`/shared + `/api/mobile/pharmacy/sales/*` | design (Phase 3) |
| Platform sandbox + monitoring | `apps/web/src/app/platform/**` | design (Phase 4) |
| ICD-11 terminology backbone | new adapter + tables | design (Phase 5) |
| Referrals (closed-loop) | extend `facility_referrals` + events | design (Phase 7) |
| Wards/inpatient | new tables + web/Expo | design (Phase 8) |
| Trajectory AI + gateway | new AI gateway package | design (Phase 6/9) |
| Surveillance signal engine | rules engine + signal states | design (Phase 9) |
| Family graph / research / wearables | new bounded contexts | design (Phase 10–12) |

## 5. Cross-cutting concerns
- **Auth/roles:** unify the fragmented role vocabulary behind the capability lattice
  (`capabilities`/`role_capabilities`/`has_capability`).
- **Audit:** consolidate `audit_events` / `audit_log` / `pharmacy_audit_logs` behind one writer
  in `@synapse/db/audit`.
- **Feature/entitlement:** `has_feature`/`gateFeature` for subscription entitlement; `feature_flags`
  for operational toggles — keep the two namespaces distinct and documented.
- **Offline:** the Expo app needs an outbox + conflict handling for POS/inventory writes
  (currently read-through cache only).
