# SYNAPSE-OS Integrated Codebase & Schema Audit — 2026-08

Status: **authoritative baseline audit** for the integrated healthcare-OS programme.
Author: principal-engineer agent. Method: read-only inspection of the `main` branch
(`e2c4c14`) plus the checked-in Supabase migrations. No production data was accessed.

> **Environment limitations that shape this audit and the work that follows**
>
> - **Live Supabase MCP is unauthenticated in this environment**, so the live schema
>   could not be introspected directly. The 34 files under `supabase/migrations/`
>   plus `packages/db/src/types.ts` (generated types) are used as the best available
>   proxy for the live schema. Every place where the live DB is the only source of
>   truth is flagged explicitly.
> - **Vercel MCP is unauthenticated**, so domain configuration was derived from repo
>   files (`vercel.json`, `apps/pharmacy/vercel.json`, `middleware.ts`, docs) rather
>   than the live Vercel project. See §9 (domains) for the `admin.synapseos.tech`
>   determination requested in the brief.
> - **No local Postgres / Docker** is available, so SQL migrations and RPCs in this
>   branch are validated by `npm run db:check` (file-level integrity) and by review,
>   not by executing them against a database. Migrations are written to be additive,
>   idempotent (`IF NOT EXISTS` / `CREATE OR REPLACE`) and reversible, and are meant
>   to be applied through the existing CI/`supabase db push` path with real access.

---

## 0. Executive summary

SYNAPSE-OS is a real, substantially-built npm-workspaces monorepo (Node 22, Turbo)
with three deployable surfaces and shared packages:

| Workspace | Package | Reality today |
|-----------|---------|---------------|
| `apps/web` | `@synapse/web` | Marketing + platform control plane (`/platform`) + hospital surfaces + **all mobile APIs** (`/api/mobile/**`). Large and mostly functional. |
| `apps/pharmacy` | `@synapse/pharmacy` | Pharmacy web portal (POS, inventory, purchasing, refunds, reports). The most mature operational product. |
| `apps/app` | `@synapse/app` | Expo app (SDK 52) for patients + healthcare workers + pharmacy staff. Core pharmacy sell path is native; several workflows still bounce to `pharm.synapseos.tech`. |
| `packages/*` | `@synapse/{auth,db,config,email,ui}` | Shared auth/session, DB clients + generated types + audit, config, email, UI. |

The single most important structural finding is a **schema-of-record gap**: the core
pharmacy POS/inventory tables the whole business runs on (`pharmacy_products`,
`pharmacy_product_batches`, `pharmacy_pos_sales`, `pharmacy_pos_sale_items`,
`pharmacy_stock_adjustments`, `pharmacy_product_packages`, `pharmacy_suppliers`,
`pharmacy_purchase_orders*`, cashier sessions/carts) have **no `CREATE TABLE` in the
checked-in migrations**. They exist only in the live database and in generated types.
This is consistent with operating rule 5 ("live schema is source of truth") but means
this repo cannot be stood up from migrations alone, and any Phase-1 change must be
**additive** and must **not recreate** those objects (rules 6–7).

The second most important finding validates the brief's Phase-1 premise exactly:
`pharmacy_products.quantity` is a **denormalized** number that multiple write paths
mutate directly (bulk import, stock adjustment, PO "received", product edit) **without
creating batch rows**, while the authoritative sell path (`complete_pharmacy_sale`
RPC) only ever allocates from **active, non-expired batch rows**. The catalogue shows
the product-level number, so a product can display sellable stock that the POS cannot
actually sell. There is no `sellableQuantity` concept anywhere today.

---

## 1. Applications, routes and build/deploy

### 1.1 Web (`apps/web`)
- Next.js 15.5, React 19. Dev on **:3001**. Root `vercel.json` builds `@synapse/web`.
- Platform control plane under `apps/web/src/app/platform/**` (see §4).
- **All mobile APIs live here** under `apps/web/src/app/api/mobile/**` (23 route files),
  including `api/mobile/pharmacy/**`. The Expo app talks only to these, never to Supabase directly.
- AI endpoints under `api/ai/*`, `api/demo/differential`, `api/tele/intake`,
  `api/health/coach`, plus pharmacy interaction explainers. Gemini with OpenRouter/DeepSeek fallback.

### 1.2 Pharmacy (`apps/pharmacy`)
- Next.js 15.5, React 19. Dev on **:3002**. `apps/pharmacy/vercel.json` deploys `synapse-pharm`.
- Portal pages under `app/portal/**`; admin APIs under `app/api/admin/**`; auth under `app/api/auth/**`.
- Vitest configured (`vitest.config.ts`), plus a `node:test` FEFO suite.

### 1.3 Expo app (`apps/app`)
- Expo SDK `~52.0.46`, RN `0.76.9`, expo-router `~4.0.20`, React 18.
- API client `apps/app/lib/api.ts` → base URL `www.synapseos.tech`, Bearer token, 45s timeout, `402 → billing-locked`.
- Token in `expo-secure-store`; biometric lock; push via `expo-notifications`.

### 1.4 Build / CI
- `.github/workflows/deploy.yml`: `npm ci` → `db:check` → `verify:web` → `verify:pharmacy`
  → Expo `type-check` (`continue-on-error: true`) → web lint (`--max-warnings 0`).
- Quality-gate reality on `main` (reproduced in this environment):
  - `db:check` ✅, `@synapse/web` type-check ✅ + build ✅, `@synapse/pharmacy` type-check ✅ + tests ✅ + build ✅.
  - **`eslint` is broken repo-wide** (`@eslint/eslintrc` loads `ajv@8` where it needs `ajv@6`; `TypeError: Cannot set properties of undefined (setting 'defaultMeta')`). This fails identically in CI on `main` — a pre-existing dependency-resolution bug, not an environment defect. See §8 and the remediation in this branch.
  - `@synapse/app` type-check fails on the documented React 18/19 dual-`@types/react` conflict (CI tolerates it).

---

## 2. Genuinely functional vs partial vs broken/mock

### Functional (real DB-backed)
- Pharmacy portal POS sell path (`complete_pharmacy_sale` RPC), inventory CRUD + batch CRUD, orders, refunds/voids, suppliers, purchase orders, reports, transactions, activity log.
- Mobile pharmacy POS (`/api/mobile/pharmacy/pos/*`), orders, sales list, inventory GET/POST, bulk-upload.
- Platform command centre, analytics, billing, support, users, pharmacy-network, feature flags, receipts, security unlock, impersonation.
- Auth/session (custom JWT `@synapse/auth`), MFA, subscription gating (`has_feature`).

### Partial
- **Hospital onboarding API** (`api/platform/hospitals`): creates rows but is **not transactional** (several `catch {}`), creates the admin auth user **without a password and sends no invitation** (UI copy promises a setup email), and creates **no subscription row** (unlike pharmacy onboarding).
- **Platform public-health page**: real diagnosis aggregation but a **dead "Publish bulletin" button**, a hardcoded "watching" notifiable list, and a naive `count >= 3` outbreak heuristic in the page.
- **DHIS2 page**: queues `dhis2_export_log` rows only; no export worker/API call.
- **Platform overview**: MRR + active-session sparklines are **synthetic** (linear ramp / repeated value).
- **Platform health API**: partially hardcoded (`rlsCoverage: "134/134"`, static Supabase block).
- **Mobile sales**: list only; no sale detail / receipt view.
- **Expo offline**: read-through TTL cache only; no offline writes / sync queue / held carts.

### Broken / mock / stub
- `eslint` (repo-wide, see above).
- `/platform/system/settings`, `/platform/guidelines`: "Coming soon" stubs.
- `/platform/hospitals` list **Export** button and filter UI: non-functional.
- Hospital list vs detail read **different tables** (`tenants` vs `hospitals`).

---

## 3. Pharmacy inventory / batch / sale data model (Phase-1 target)

### 3.1 Tables (from live types; **absent from migrations**)
- `pharmacy_products(… quantity int, batch_number, expiry_date, is_active, …)` — `quantity` is a **denormalized aggregate**.
- `pharmacy_product_batches(product_id, tenant_id, batch_number, quantity, initial_quantity, expiry_date, received_date, cost_price, is_active, notes, …)` — **only `is_active` as a lifecycle flag**; no `status`/quarantine/damaged/recalled.
- `pharmacy_pos_sales`, `pharmacy_pos_sale_items(… batch_id, line_total GENERATED …)`, `pharmacy_stock_adjustments`, `pharmacy_product_packages`, `pharmacy_suppliers`, `pharmacy_purchase_orders(+_items)`, `pharmacy_sale_idempotency` (this last one **is** in migrations).
- App selects `batch.manufacturer`, which is **not** in generated types → schema/code mismatch to resolve.

### 3.2 The authoritative sell path
`complete_pharmacy_sale` (latest: `supabase/migrations/20260730120000_pos_sale_idempotency_in_rpc.sql`):
advisory-locks per tenant for receipt numbering; atomic in-RPC idempotency claim
(`pharmacy_sale_idempotency`); inserts sale `pending`; per line, locks product, FEFO-allocates
over batches `is_active AND quantity>0 AND (expiry_date IS NULL OR expiry_date >= Kampala today)`
ordered by `expiry_date ASC NULLS LAST, received_date ASC`; decrements batch and inserts one
sale-item slice per batch; raises `INSUFFICIENT_STOCK: <name> short by <n> units` if short;
then `UPDATE pharmacy_products SET quantity = greatest(quantity - taken, 0)`; finalises `completed`.
`EXPIRED_BATCH_BLOCKED` exists in the TS error map but is **not raised** by the current RPC
(expired batches are silently skipped).

### 3.3 Write paths that desynchronise product.quantity from batches
| Path | Creates batch? | Product qty | Problem |
|------|----------------|-------------|---------|
| Batch POST/PATCH/DELETE | yes | ± delta | OK |
| Product POST with `batches[]` | yes | = Σ batches | OK |
| **Stock adjustment** POST | **no** | direct set | bypasses batch ledger |
| **PO status → RECEIVED** | **no** | direct += | bypasses batch ledger |
| **Bulk CSV/XLSX upload** | **no** | product row | creates "phantom" sellable stock |
| **Product PATCH** | no | direct set | drift |
| Sale RPC / refund | yes | synced | OK |

### 3.4 Catalogue vs sellable
`GET /api/admin/inventory` and `GET /api/mobile/pharmacy/pos/products` both return
`quantity: product.quantity` and, separately, `is_active && quantity>0` batches
**without expiry filtering**. There is **no `sellableQuantity`**. POS add-to-cart is not
blocked when FEFO preview is empty but `product.quantity > 0`.

### 3.5 POS error shape today
On RPC error the routes return `{ error: friendlyString, code: PREFIX }` with HTTP 409
for stock errors. **No** `productId`, `productName`, `requestedQuantity`, `sellableQuantity`,
`reasonCode`, `humanMessage`, or `recommendedAction` — exactly the structured contract the
brief requires (see Phase-1 remediation).

### 3.6 CSV/XLSX import
`POST /api/admin/inventory/bulk-upload` (portal) and `/api/mobile/pharmacy/inventory/bulk-upload`
parse a **pasted CSV string**; require name + a positive price/cost; **do not require or
validate batch number / quantity / expiry**; store optional batch/expiry on the **product row**;
and **never create `pharmacy_product_batches`**. XLSX is not parsed on device (the Expo app
links out to the portal). No expiry-in-past rejection.

---

## 4. Platform control plane (`/platform`)

Real, DB-backed registry + CRM + billing + support + flags + analytics. Route inventory,
data sources and functional verdicts are enumerated in the web audit (see the source report
referenced in the PR). Key gaps for the brief's Phase-4:
- Onboarding is not transactional/recoverable and exposes/omits credentials incorrectly.
- **No "Create Test Hospital" / sandbox** capability, no synthetic-data generator, no reset/delete-synthetic workflow.
- **Impersonation exists** (`api/platform/impersonate`, 2h JWT, `is_impersonation`, `synapse_sessions`, audit `IMPERSONATION_START`) but there is **no time-limited, read-only-by-default, banner-enforced, per-entity-audited "support session"** with facility-admin visibility and no platform-wide patient browser. This is the safe base to extend.
- Monitoring pages exist but mix real counts with **hardcoded/synthetic** values; no health-level state machine (`healthy/degraded/failing/unknown/maintenance`), no alert ack/assign/resolve.

---

## 5. Clinical, referral, ward, surveillance, ICD-11 (Phases 5–9)

- **Clinical core (in migrations):** `patients`, `encounters` (vitals **inline** on the encounter — no separate `observations`/`vitals` table in migrations), `encounter_diagnoses(icd11_code, certainty, is_primary, ai_suggested, ai_confidence)`, `lab_orders`/`lab_results`, `insurance_providers`/`insurance_claims(icd11_codes[])`, `clinical_note_embeddings(vector(1536))`, `patient_history_queries(query_embedding vector(1536))`.
- **ICD-11 fields present:** only `icd11_code` (diagnoses, outbreak_alerts) and `icd11_codes[]` (claims). **Absent everywhere:** `who_uri`, `postcoordination`, `coding_status`, ICD-11 release/version, foundation URI. The generated types hint at `stem_code`/`cluster_code`/`foundation_uri` on the live diagnoses table → schema/code drift.
- **Distinct clinical concepts** (chief complaint vs symptom vs finding vs differential/provisional/confirmed/ruled-out, PMH, family history, cause of death) are **not** modelled distinctly; they are free-text SOAP fields + a single diagnoses table.
- **Referrals:** `facility_referrals` (in migrations) has a **5-state** lifecycle (`pending/accepted/rejected/completed/cancelled`) — far short of the brief's 14-state closed-loop. A richer `referral_requests` and `referral_events` appear in types only. No `ServiceRequest`/`Task` modelling.
- **Wards/inpatient:** **not in migrations at all**; `wards`, `hospital_beds`, `bed_assignments` appear in types only. No admissions/transfers/discharge/nursing-obs/MAR/ward-stock-request tables.
- **Surveillance:** `outbreak_alerts` (in migrations); `surveillance_reports` has **RLS policies but no `CREATE TABLE`** in migrations; `surveillance_signals`, `dhis2_export_log`, `sentinel_alerts` absent from migrations. The "3 cases = outbreak" rule is **application-only** (`count >= 3`), never in SQL, and there is **no signal-state machine** (`detected → … → confirmed_outbreak → closed`).
- **AI/embeddings:** pgvector is enabled; embeddings + history-query tables exist. No model-independent gateway, no guardrail/eval harness, no evidence-linking layer, no prompt/version registry. Gemini is called directly in several routes.

---

## 6. Family graph, research/lab, citizen/wearables (Phases 10–12)
- **Consent:** only `facility_referrals.consent_obtained/consent_method`; `patient_consents`/`consent_audit_log` in types only. No family-relationship tables. No NIRA adapter (must be adapter + sandbox only).
- **Research / reference-lab portals:** none present (no cohort/de-identification/OMOP/chain-of-custody structures).
- **Citizen/wearables:** patient-facing Expo screens exist (records, meds, appointments, claims); **no** wearable adapters (Health Connect/HealthKit), no provenance model, no sensitive-category (menstrual/pregnancy/sexual-health) permission separation.

---

## 7. Security & governance posture
- **Tenant isolation:** enforced server-side in mobile/portal routes via JWT `tenant_id`; RLS present on ~50+ tables with a consistent `tenant_id = current_tenant_id() OR is_platform_admin()` pattern. **But** the core pharmacy POS tables have **no migration-defined RLS** (live state unknown) — must be confirmed against the live DB.
- **Service role:** used correctly only in server routes (`@synapse/db/admin` throws if imported in the browser; lazy proxy).
- **IDOR risks:** `GET /api/mobile/inventory` authorises any authenticated user with a `tenant_id` (no pharmacy-role check) → can expose pharmacy stock to non-pharmacy roles.
- **Audit fragmentation:** three log tables in play — `audit_events` (migrations), `audit_log`/`audit_logs` (referenced, not created), `pharmacy_audit_logs` (types) — writers disagree. Needs consolidation.
- **Debug logging:** `packages/db/src/admin.ts` logs `url_char0`/`key_char0` at instantiation — low-risk but noisy; should be removed.
- **No break-glass** with reason/expiry; **no consent/retention/export-audit/session-revocation** primitives beyond the above.

## 8. Missing APIs & mobile-to-web redirects (Phase-2 target)
- **Explicit `Linking.openURL('https://pharm.synapseos.tech/portal/…')` escapes** in the Expo app: `profile.tsx` (dashboard, inventory, refunds, reports, users, billing — 6 buttons), `stock-import.tsx` (Excel), `billing-locked.tsx` (billing). These are the ordinary-workflow redirects Phase-2 must replace with native screens + mobile APIs.
- **Missing mobile APIs** (present only as pharmacy-portal `/api/admin/*`): reports, refunds/returns, suppliers, purchase-orders, users/staff, settings, sale-detail + **receipt (view/PDF/share-log/reprint)**, receiving/GRN, stock transfer/count.
- **Expo dependency gaps** for native receipts/import: `expo-print`, `expo-sharing`, `expo-file-system`, `expo-document-picker`, `expo-mail-composer`, a barcode scanner — **none installed**.

## 9. Domains (operating rule 16)
Repo evidence (`middleware.ts`, `vercel.json`, email senders, docs) shows the platform is
served on the **`admin.` subdomain**: `middleware.ts` rewrites the `admin` subdomain to
`/platform/*` and gates it on `platform_admin`. All hostnames use the **`synapseos.tech`**
apex (`www`, `pharm`, `app`, `demo`, `*.synapseos.tech`). **No `signupsos` reference exists
anywhere in the repo.** Therefore the intended platform hostname is **`admin.synapseos.tech`**,
and `admin.signupsos.tech` is **incorrect**. Recommendation: keep the `/platform` route,
standardise the documented custom hostname as `admin.synapseos.tech`, and confirm the domain
binding in the Vercel dashboard once Vercel access is available (MCP was unauthenticated here).

## 10. Tests present today
- Pharmacy: `lib/pos/{fefo,fefo.allocate,sale-validation,idempotency}.test.ts`, `lib/{api-auth,capabilities}.test.ts`, `app/api/admin/pos/{complete-sale,transaction}/route.test.ts`. **No** live-DB integration, batch/product reconciliation, receiving, refund, or cross-tenant tests.
- Web: no test runner/script.
- Expo: type-check only (tolerated failure).

---

## 11. Proposed migrations (additive, reversible, timestamped)
All guarded with `IF NOT EXISTS` / `CREATE OR REPLACE`; none drop or recreate existing objects.

1. **`pharmacy_inventory_authority`** (Phase-1, included in this branch):
   - `ALTER TABLE pharmacy_product_batches ADD COLUMN IF NOT EXISTS status text` with
     `CHECK (status IN ('active','quarantined','damaged','recalled','expired'))` default `'active'`,
     plus `manufacturer text` (resolve code/type mismatch), `quarantine_reason`, `recalled_at`, `damaged_reason`.
   - View/function `pharmacy_inventory_summary(tenant, product)` returning
     `physical/sellable/expired/quarantined/damaged/unbatched` quantities (Kampala-date aware).
   - `CREATE OR REPLACE FUNCTION complete_pharmacy_sale(...)` — same signature, additionally
     excludes non-`active` status batches and raises a **structured** `INSUFFICIENT_STOCK`
     payload (product id/name, requested, sellable). Backward compatible.
   - `receive_pharmacy_stock(...)` RPC — new stock enters **only** by creating/《topping-up》 a batch
     (requires genuine batch number, quantity, expiry) inside a transaction + audit.
   - `report_unbatched_positive_stock(tenant)` — detects legacy products with `quantity > 0`
     and no usable batch rows (safe migration report; never fabricates batches).
   - Rollback notes inline.
2. Later phases (designed in `docs/architecture/*`, **not** applied here): distinct clinical
   observation/finding tables + ICD-11 columns; 14-state referral lifecycle + events;
   ward/inpatient + MAR + ward-stock-request; surveillance signal-state machine + rules engine;
   consent/family-graph; research/de-identification; wearables provenance.

## 12. Phased implementation plan & exact files
See `docs/release/implementation-status.md` for the live status ledger. Ordering follows the
brief: **(1) audit → (2) pharmacy data correctness → (3) native receipts → (4) remaining native
pharmacy → (5) platform sandbox/monitoring → (6) ICD-11 → (7) referrals → (8) wards → (9) trajectory
AI → (10) surveillance → (11) family/research/lab → (12) citizen/wearables.** No later phase starts
while an earlier build/test/security gate is red.

Exact files expected to change per phase are listed in `docs/release/implementation-status.md`.

## 13. Top risks (ranked)
1. **Schema-of-record gap** — core pharmacy tables not in migrations; the repo cannot be rebuilt from scratch and additive migrations must assume live shapes. (Mitigation: keep everything `IF NOT EXISTS`/`CREATE OR REPLACE`; confirm against live DB before apply.)
2. **Phantom sellable stock** — denormalized `product.quantity` diverges from batches (Phase-1 fixes this).
3. **Broken lint gate** — blocks the "don't disable gates" mandate until the `ajv` resolution is fixed (fixed in this branch).
4. **Onboarding not transactional; credentials handling wrong** (Phase-4).
5. **Over-permissive mobile inventory GET / IDOR** and **audit-table fragmentation**.
6. **No sandbox/synthetic isolation** — the mandated end-to-end demo needs a synthetic tenant that cannot touch real integrations; this does not exist yet.
