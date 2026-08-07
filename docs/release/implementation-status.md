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

## Inventory-authority hardening (2026-08-07) — ONE INVENTORY TRUTH

Goal: every stock change flows through batch-authoritative, transactional, audited RPCs; Web and
Expo never independently mutate quantities. `pharmacy_products.quantity` is kept equal to the sum of
its batch quantities; POS sells against derived `sellableQuantity`.

**Authoritative domain operations (SQL RPCs, `SECURITY DEFINER`, `search_path=public`):**
- `complete_pharmacy_sale` — FEFO sale, status-aware, idempotent, structured `INSUFFICIENT_STOCK`.
- `receive_pharmacy_stock` — the only way to add sellable stock (genuine batch + future expiry).
- `adjust_pharmacy_stock` — **new**: batch-target or FEFO decrease; reason required; records movement
  (`pharmacy_stock_adjustments`) + audit; increases without a batch are rejected.
- `recompute_pharmacy_product_quantity` — keeps product.quantity = Σ batch quantities.

**Write paths rewired to authority (no more direct `product.quantity` writes):**
- ✅ Web portal stock adjustment (`/api/admin/inventory/stock`) → receive/adjust RPCs.
- ✅ Mobile stock correction (`/api/mobile/inventory/[id]` PATCH) → adjust RPC (increase → receive).
- ✅ Web bulk import → opening stock enters as real batches via `receive_pharmacy_stock`; never
  creates phantom sellable stock (unbatched rows import at quantity 0 with a warning).
- Already authoritative: mobile POS sale, mobile receiving (GRN), refunds/void (batch + product restore).

**Migrations added (additive, reversible, guarded — REVIEW before `supabase db push`, not applied here):**
- `20260805130000_pharmacy_inventory_authority.sql` (batch status, summary view, receiving RPC, structured sale error).
- `20260806120000_pharmacy_settings_receipt_identity.sql` (receipt identity columns).
- `20260807120000_pharmacy_stock_authority_and_perms.sql` (adjust RPC, recompute, **function permission hardening**: revoke anon/public, grant authenticated+service_role).
- `20260807130000_pharmacy_rls_tenant_isolation.sql` (**RLS + tenant policies** on core pharmacy tables; service role bypasses RLS so app flows are unaffected — pure defense-in-depth).

**Security/RLS:** RLS enabled with `tenant_id = current_tenant_id() OR is_platform_admin()` on core
pharmacy tables; SECURITY DEFINER RPCs are no longer anon-callable. Service-role key is server-only;
the Expo app ships only the public anon key (`app.json`), never service-role.

**Still requires a live DB (cannot be verified in this environment):** applying the four migrations
above and running DB-integration tests (concurrent deduction, refund reversal, cross-tenant RLS,
idempotent retry). These are specified in `docs/testing/integrated-smoke-test.md` + the CARE PLUS
checklist below and must run against a real Supabase before pilot sign-off.

## CARE PLUS manual pilot checklist (run against a live Supabase after applying migrations)
1. Onboard pharmacy → add staff (invite) → add supplier.
2. Add/import medicines (import: rows without batch import at qty 0; rows with batch+expiry become sellable).
3. Create PO → receive **two batches, different expiries** → verify stock = sum of batches.
4. POS sale → confirm FEFO picked the **earliest-expiry** batch → print/generate receipt.
5. Verify batch quantity and total inventory both decreased; check movement + audit history.
6. Refund the sale → verify batch + product quantity restored; sale shows voided (not deleted).
7. Log in on Expo → see the same inventory → do an allowed op (receive/adjust) → verify Web reflects it.
8. Log in as a **different tenant** → confirm no access to the first pharmacy's data.
9. Edge cases: sell expired batch (blocked), insufficient stock (structured error), duplicate sale
   submission (idempotent, no double-sell), network failure mid-sale (no phantom success),
   unauthorized adjustment (403), cross-tenant record fetch (404/empty).

## APK status
Build-ready. `apps/app/eas.json` has a `preview` profile (Android **APK**); `app.json` has package
`tech.synapseos.app`, EAS `projectId`, minimal permissions (INTERNET, ACCESS_NETWORK_STATE), coherent
branding, and only the **public** Supabase anon key. **Blocker:** no Expo/EAS credentials in this
environment (`eas whoami` → Not logged in, `EXPO_TOKEN` unset). Exact command once credentials exist:
`cd apps/app && eas build --platform android --profile preview` (or set `EXPO_TOKEN`). Metro
`expo export --platform android` passes as the local buildability proof. No APK was faked.

## Phase status
| Phase | Scope | Status |
|-------|-------|--------|
| 0 | Audit & baseline | ✅ `docs/current-state/2026-08-synapse-integrated-audit.md` |
| 1 | Pharmacy data correctness | ✅ shared domain + wiring + tests + additive migration |
| 2 | Fully-native pharmacy app | 🟡 onboarding, change-password, settings, reports, users, billing, suppliers, receiving (GRN), refunds now native; all `profile.tsx`/`billing-locked`/`stock-import` portal redirects removed. Remaining: full PO lifecycle UI + POS depth (held carts, sessions, offline, barcode) |
| 3 | Receipt engine | ✅ shared immutable receipt domain + 5 mobile APIs + native screen |
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

## Completed since (Phase 2/3)
- ✅ `@synapse/db/receipt` — immutable receipt snapshot, EFRIS-only fiscal labelling, thermal-text +
  print-HTML renderers (8 tests).
- ✅ Mobile receipt APIs (tenant+role scoped): `GET /sales/:id`, `GET /sales/:id/receipt`,
  `GET /sales/:id/receipt.pdf` (print HTML), `POST /sales/:id/share-log`, `POST /sales/:id/reprint`.
- ✅ Native Expo receipt screen (`app/receipt/[saleId].tsx`) — preview + Print + Share + Email +
  Reprint (via expo-print/sharing/mail-composer/file-system); sales list & POS success tap-through.
- ✅ Native CSV/XLSX import via `expo-document-picker` + on-device SheetJS parse; the
  `pharm.synapseos.tech` Excel redirect in `stock-import.tsx` is removed.

## Completed since (Phase 2 native pharmacy + onboarding)
- ✅ In-app onboarding (5-step wizard) + change-password + launch gating (BFF `GET/POST /onboarding`,
  `POST /auth/mobile/change-password`).
- ✅ Native Settings (identity: TIN, NDA licence, supervising pharmacist + reg no., receipt header/footer,
  VAT, thresholds) + BFF + additive `pharmacy_settings` identity migration (powers compliant receipts).
- ✅ Native Reports (sales/profit/payment-mix/top-products/low-stock/expiry) with on-device CSV export/share.
- ✅ Native Staff & users (list/invite/disable/reactivate/reset-password) + BFF.
- ✅ Native Billing (subscription state, payments, plans) + BFF; `billing-locked` now routes native.
- ✅ Native Suppliers (list/add/edit) + BFF.
- ✅ Native Receiving / GRN — new stock enters ONLY via a real batch through `receive_pharmacy_stock`
  (Phase-1 rule): batch number + positive qty + future expiry required.
- ✅ Native Refunds/void (restores batch + product qty, audited) + history + receipt-screen action.
- ✅ **All ordinary `pharm.synapseos.tech` redirects removed** from the app (profile, stock-import Excel,
  billing-locked).

## Partial / not-started (honest)
- 🟡 Full purchase-order lifecycle UI (create PO, approve, partial receive against a PO) — suppliers +
  batch receiving are native; PO documents themselves are next.
- 🟡 POS depth (held carts, cashier sessions, offline drafts, barcode scan) — designed, not built.
- 🟡 Inventory management depth (stock transfer, count, quarantine/recall management screens) — the
  data model + receiving exist; dedicated screens pending.
- 🟡 Transactional facility provisioning, sandbox test-hospital, real monitoring, safe support sessions.
- ⛔ ICD-11 concept model, trajectory AI + gateway + eval harness, 14-state referrals, wards/inpatient,
  surveillance signal engine, family graph, research/lab portal, wearables.
- 🚫 Live DB apply of the Phase-1 migration and DB-integration tests (no DB access here).

## Exact files changed in this branch
Phase 1:
- `packages/db/src/inventory.ts` (new), `packages/db/src/import-validation.ts` (new),
  `packages/db/src/index.ts`, `packages/db/package.json`
- `apps/web/src/app/api/mobile/pharmacy/pos/products/route.ts`,
  `apps/web/src/app/api/mobile/pharmacy/pos/complete-sale/route.ts`
- `apps/pharmacy/app/api/admin/inventory/route.ts`,
  `apps/pharmacy/app/api/admin/pos/complete-sale/route.ts`
- `apps/pharmacy/lib/pos/inventory-authority.test.ts` (new)
- `supabase/migrations/20260805130000_pharmacy_inventory_authority.sql` (new)

Phase 3 (receipts):
- `packages/db/src/receipt.ts` (new), `apps/pharmacy/lib/pos/receipt-domain.test.ts` (new)
- `apps/web/src/lib/pharmacy-receipt.ts` (new)
- `apps/web/src/app/api/mobile/pharmacy/sales/[saleId]/{route,receipt/route,receipt.pdf/route,share-log/route,reprint/route}.ts` (new)

Phase 2 (native app):
- `apps/app/app/receipt/[saleId].tsx` (new), `apps/app/lib/api.ts`,
  `apps/app/app/(main)/sales.tsx`, `apps/app/app/pos.tsx`, `apps/app/app/stock-import.tsx`,
  `apps/app/package.json` (expo-print/sharing/file-system/document-picker/mail-composer, xlsx)

Docs: audit, architecture ×5, security, testing, release, api.

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
