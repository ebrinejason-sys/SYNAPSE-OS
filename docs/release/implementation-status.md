# Implementation Status Ledger

Branch: `cursor/pharmacy-pilot-v1-9386` (Pilot-Ready v1 work). Honest status — no phase is claimed
done unless built, buildable, and tested. Live DB apply remains a separate ops gate.

## Legend
✅ done & tested · 🟡 partial · 📐 designed only · ⛔ not started · 🚫 blocked

## Overall
**SYNAPSE Pharm Pilot-Ready v1: YELLOW.**

In-repo: inventory write-path convergence, hardening migration, portal receiving UX, camelCase API
fixes, native pharmacy ops screens + mobile BFFs, barcode scan, POS draft/pending-sync, builds green.

Blocked for GREEN: live apply of inventory-authority + hardening migrations; real smoke test;
EAS-authenticated APK.

Authoritative pilot ledger: `docs/release/PHARMACY_PILOT_V1.md` · smoke: `docs/release/PHARMACY_PILOT_SMOKE.md`.

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
- ✅ Web portal stock adjustment (`/api/admin/inventory/stock`) → receive/adjust RPCs via `@synapse/db/inventory-rpc`.
- ✅ Mobile stock correction (`/api/mobile/inventory/[id]` PATCH) → adjust/receive helpers.
- ✅ Web bulk import → opening stock enters as real batches via `receivePharmacyStock`; never
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
| 0 | Audit & baseline | ✅ + live recheck 2026-08-07/10 |
| 1 | Pharmacy data correctness | 🟡 code+tests+migrations ready; **live schema still pre-authority** |
| 2 | Fully-native pharmacy app | 🟡 onboarding, change-password, settings, reports, users, billing, suppliers, receiving (GRN), refunds native; PO lifecycle + POS depth still partial |
| 3 | Receipt engine | ✅ shared domain + mobile APIs + native screen |
| 4–12 | Platform / clinical / surveillance / … | 📐 architecture docs only |

## Live DB facts (anon probe 2026-08-10, project `qfqakzmjatszisuqjwon`)
- No `pharmacy_product_batches.status`
- No `pharmacy_inventory_summary`
- No `receive_pharmacy_stock` / `report_unbatched_positive_stock` / adjust / reverse RPCs
- `complete_pharmacy_sale` still overloaded / anon-callable until hardening applied

## Quality gates (this branch, agent run)
| Check | Result |
|-------|--------|
| `npm run db:check` | ✅ |
| `@synapse/pharmacy` tests | ✅ 95 + FEFO |
| pharmacy / web type-check | ✅ |
| pharmacy / web production build | ✅ |
| Expo android export | ✅ |
| EAS preview APK | ❌ not logged in |
| Live smoke | 🚫 blocked |

## Native pharmacy ops (merged from inventory-authority hardening)
- ✅ In-app onboarding + change-password + launch gating.
- ✅ Native Settings (receipt identity) + Billing + Reports + Staff + Suppliers + Receiving/GRN + Refunds.
- ✅ Ordinary `pharm.synapseos.tech` redirects removed from profile / billing-locked for those flows
  (optional advanced portal link retained).

## Remaining for GREEN
- Live apply of inventory-authority + hardening + RLS migrations.
- Real smoke against live Supabase (`docs/release/PHARMACY_PILOT_SMOKE.md`).
- EAS-authenticated preview APK.
- Full PO lifecycle UI + deeper POS (held carts / offline) as follow-ons.

## Lint note
Repo-wide eslint ajv/`@eslint/eslintrc` breakage remains a pre-existing main issue — not introduced here.
