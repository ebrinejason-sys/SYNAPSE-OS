# Implementation Status Ledger

Branch: `cursor/synapse-integrated-os-platform-pharm-native`. Honest status per the operating
rules — no phase is claimed done unless it is built, buildable, and tested.

## Legend
✅ done & tested · 🟡 partial (documented) · 📐 designed only · ⛔ not started · 🚫 blocked

## Overall
This branch delivers the **mandated audit (Phase 0)** and **Phase 1 (pharmacy data correctness)**
as working, tested, buildable code plus an additive migration, and delivers the **full design +
status documentation** for Phases 2–12. Later phases are intentionally **not** scaffolded with fake
UI (operating rule 10); they are specified in `docs/architecture/*` and here.

Two environment limits bound this work: (a) **no live DB / Supabase + Vercel MCP unauthenticated**
(so the additive migration is validated by review + `db:check`, not applied; DB-integration tests
are specified not executed), and (b) the **repo-wide `eslint` gate is pre-existing-broken** (ajv/
`@eslint/eslintrc` resolution — red on `main` too); see remediation below.

## Phase status
| Phase | Scope | Status |
|-------|-------|--------|
| 0 | Audit & baseline | ✅ `docs/current-state/2026-08-synapse-integrated-audit.md` |
| 1 | Pharmacy data correctness | ✅ shared domain + wiring + tests + additive migration |
| 2 | Fully-native pharmacy app | 📐 `docs/architecture/pharmacy-native-mobile.md` |
| 3 | Receipt engine | 📐 same doc |
| 4 | Platform sandbox + monitoring | 📐 `docs/architecture/platform-control-plane.md` |
| 5 | ICD-11 clinical foundation | 📐 `docs/architecture/clinical-ai-safety.md` |
| 6 | Trajectory AI + gateway | 📐 same doc |
| 7 | Closed-loop referrals | 📐 architecture doc (extend `facility_referrals`) |
| 8 | Wards / inpatient | 📐 architecture doc |
| 9 | DHO surveillance | 📐 `docs/architecture/public-health-surveillance.md` |
| 10 | Family health graph | 📐 architecture/threat-model |
| 11 | Research / reference lab | 📐 architecture |
| 12 | Citizen / wearables | 📐 architecture |

## Completed features (this branch)
- ✅ Integrated audit of code + migrations + domains, incl. the `admin.synapseos.tech` determination.
- ✅ `@synapse/db/inventory` — `summarizeInventory`, `allocateFefo`, `buildStockError`,
  `isSellableBatch`, `normaliseBatch`, `parseRpcStockError` (physical/sellable/expired/quarantined/
  damaged/unbatched; status- and expiry-aware).
- ✅ `@synapse/db/import-validation` — batch number / positive-int quantity / non-past expiry rules.
- ✅ Catalog endpoints expose `sellableQuantity` + phantom-stock signals; batches filtered to sellable.
- ✅ Checkout endpoints return the structured `stockError` contract.
- ✅ Additive migration: batch `status` + fields, `pharmacy_inventory_summary` view,
  `report_unbatched_positive_stock`, `receive_pharmacy_stock`, status-aware `complete_pharmacy_sale`.
- ✅ 24 new unit tests (all required Phase-1 scenarios) + existing suites green.

## Partial / not-started (honest)
- 🟡 Native pharmacy screens for reports/refunds/suppliers/users/settings/receipts and removal of the
  7 `pharm.synapseos.tech` redirects — designed, not built.
- 🟡 Transactional facility provisioning, sandbox test-hospital, real monitoring, safe support sessions.
- ⛔ ICD-11 concept model, trajectory AI + gateway + eval harness, 14-state referrals, wards/inpatient,
  surveillance signal engine, family graph, research/lab portal, wearables.
- 🚫 Live DB apply of the Phase-1 migration and DB-integration tests (no DB access here).

## Exact files changed in this branch
- `packages/db/src/inventory.ts` (new), `packages/db/src/import-validation.ts` (new),
  `packages/db/src/index.ts`, `packages/db/package.json`
- `apps/web/src/app/api/mobile/pharmacy/pos/products/route.ts`
- `apps/web/src/app/api/mobile/pharmacy/pos/complete-sale/route.ts`
- `apps/pharmacy/app/api/admin/inventory/route.ts`
- `apps/pharmacy/app/api/admin/pos/complete-sale/route.ts`
- `apps/pharmacy/lib/pos/inventory-authority.test.ts` (new)
- `supabase/migrations/20260805130000_pharmacy_inventory_authority.sql` (new)
- `docs/**` (audit, architecture ×5, security, testing, release, api)

## Exact files expected to change next (by phase)
- **P2/P3:** `apps/app/app/(main)/profile.tsx`, `apps/app/app/stock-import.tsx`,
  `apps/app/app/billing-locked.tsx`, `apps/app/app/pos.tsx`, `apps/app/app/(main)/sales.tsx`,
  new `apps/app/app/{reports,refunds,suppliers,users,settings,receipt}/*`,
  `apps/app/package.json` (expo-print/sharing/file-system/document-picker/mail-composer/camera),
  new `apps/web/src/app/api/mobile/pharmacy/{reports,refunds,suppliers,purchase-orders,users,settings,sales}/**`.
- **P4:** `apps/web/src/app/platform/hospitals/**`, `api/platform/hospitals/route.ts`,
  new `platform/sandbox/**` + `api/platform/sandbox/**`, `platform/health/**`,
  new `support_sessions` migration.
- **P5–P9:** new clinical-terms / referral-events / ward / surveillance-signal migrations + web/Expo screens.

## Quality gates (this branch)
See the PR description for recorded output. Summary: `db:check` ✅ · `@synapse/web` type-check ✅ ·
`@synapse/pharmacy` type-check ✅ · pharmacy tests ✅ (incl. 24 new) · web build ✅ · pharmacy build ✅ ·
Expo type-check ❌ (pre-existing React 18/19 dual-types; CI tolerates) · `eslint` ❌ (pre-existing ajv).

## Lint-gate remediation (recommended, separate change)
`@eslint/eslintrc` loads `ajv@8` where it needs `ajv@6`. A scoped `overrides` entry
(`"@eslint/eslintrc": { "ajv": "^6.12.6" }`) is the intended fix, but npm would not reconcile it
into the committed `package-lock.json` incrementally in this environment, and a full lockfile
regeneration is too broad to bundle safely with a data-correctness change in a healthcare monorepo.
Recommend a dedicated PR that regenerates the lockfile with that override and re-runs all builds.
