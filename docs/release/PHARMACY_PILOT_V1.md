# SYNAPSE Pharm — Pilot-Ready v1

**Executive status: YELLOW**

Branch: `cursor/pharmacy-pilot-v1-9386` · PR: https://github.com/ebrinejason-sys/SYNAPSE-OS/pull/35  
Last updated: 2026-08-10.

The pharmacy operational loop is implemented in-repo and build-verified, but the milestone is
**not GREEN** until live migrations are applied and the 18-step smoke test PASSes on a real
pilot tenant. This agent cannot apply migrations or produce an EAS APK with current credentials.

---

## 1. Executive status: YELLOW

| Gate | Status |
|------|--------|
| Web production build | ✅ verified |
| Android Expo export | ✅ verified |
| Android installable APK (EAS preview) | ❌ blocked — `eas-cli` not logged in |
| Live inventory-authority migrations | ❌ not applied (confirmed live) |
| Live receive → FEFO sale → receipt → refund smoke | ❌ blocked (no service-role / migrations) |
| Shared inventory/sales/receipt authority in code | ✅ |

---

## 2. Web status
- `@synapse/pharmacy` **type-check ✅**, **tests ✅** (95 vitest + FEFO node), **production build ✅**
- POS complete-sale via RPC; inventory receive/adjust/batch/PO receive/bulk import/refunds converged on authority RPCs
- Portal camelCase API contracts fixed (suppliers/POs/customers/orders/refunds)
- Dashboard: staff-accessible; pending orders from real open POs + pending orders
- Reconciliation report for unbatched stock (no fabricate)
- Receipt print path preserved; shared receipt domain available for mobile

## 3. Android status
- Expo **android export ✅** (`expo export --platform android` → Hermes bundle)
- Native: home, POS (draft cart + pending-sync UX), stock, receive, import, sales, receipt print/share/email/reprint, suppliers, POs, reports, refunds, settings, users, barcode scan (`expo-camera` + manual fallback)
- Profile portal redirects removed for those flows; **billing remains portal** (deferred)
- App identity: name `Synapse`, package `tech.synapseos.app`, version `1.1.0` / versionCode `2`
- API base: `https://www.synapseos.tech` (no localhost in config)
- EAS preview APK: **not produced** — `npx eas-cli whoami` → `Not logged in`

## 4. Database status (live, read-only probe 2026-08-10)
Using Expo anon key against `qfqakzmjatszisuqjwon.supabase.co`:
- `pharmacy_product_batches.status` **does not exist**
- `pharmacy_inventory_summary` **absent**
- `receive_pharmacy_stock` / `report_unbatched_positive_stock` / `adjust_pharmacy_batch_stock` / `reverse_pharmacy_sale` **absent**
- `complete_pharmacy_sale` **still has multiple overloads** and is reachable by anon (permission/overload smell)
- Agent `.env` service role targets placeholder URL / invalid key for live project → **cannot apply migrations from this run**

## 5. Migration status
| Migration | Repo | Live |
|-----------|------|------|
| `20260805130000_pharmacy_inventory_authority.sql` | ✅ | ❌ not applied |
| `20260810120000_pharmacy_pilot_authority_hardening.sql` | ✅ | ❌ not applied |

Apply order (human/ops with real service role): dry-run → push → verify status column + RPCs + grants → run smoke.

## 6. Security status
- Hardening migration revokes EXECUTE of privileged pharmacy RPCs from `anon`/`authenticated`; grants `service_role` only
- Client apps continue to call sales via server BFFs (admin/service role) — correct pattern
- Live still shows overload ambiguity + anon-callable sale RPC until hardening is applied
- No service-role key in Expo / browser bundles (anon only in `app.json`)

## 7. Features completed (demonstrated in code + builds/tests)
- Authoritative receive / adjust / reverse RPC wrappers + write-path convergence (web + mobile)
- FEFO domain + sale RPC design (status-aware once migrated)
- Unbatched reconciliation report (safe; no fabrication)
- Portal receiving UX (PO + stock increase require batch/expiry)
- Native pharmacy ops screens + mobile BFFs
- Barcode scan (camera + manual)
- Offline-safe POS **draft** cart with idempotent retry messaging (never claims sold without server confirm)
- Pharmacy-language RPC error parsing tests

## 8. Features deliberately deferred
- Native billing / subscription management (portal link retained)
- Full offline inventory ledger (explicitly forbidden)
- EFRIS fiscal receipts (non-fiscal unless integration accepts)
- Blindly re-sellable medication returns (refunds default `restoreAs=quarantined`)
- Multi held-cart server sessions / cashier shift close polish
- Live migration apply + seeded pilot smoke (infra)

## 9. Test commands and results
```
npm run db:check                          → ✅ 36 migration files OK
npm run test --workspace @synapse/pharmacy → ✅ 95 vitest + 3 FEFO node
npm run type-check --workspace @synapse/pharmacy → ✅
npm run type-check --workspace @synapse/web → ✅
```
Live integration / smoke: **not run** (see §4–5).

## 10. Build commands and results
```
npm run build --workspace @synapse/pharmacy → ✅
npm run build --workspace @synapse/web → ✅
npm run export:android --workspace @synapse/app → ✅ (dist/)
npm run build:apk --workspace @synapse/app → ❌ EAS not logged in
```

## 11. Real pilot smoke-test results
Procedure: `docs/release/PHARMACY_PILOT_SMOKE.md`  
All 18 steps: **⬜ not executed** (migrations absent + no service role). Domain FEFO unit coverage acts as proxy only.

## 12. Remaining blockers
1. Apply both pharmacy inventory migrations to live `SYNAPSE_OS` with verified service credentials
2. Drop obsolete `complete_pharmacy_sale` overloads if PostgREST still ambiguous after replace
3. Run `PHARMACY_PILOT_SMOKE.md` on pilot tenant; fill PASS/FAIL
4. `eas login` + `npm run build:apk --workspace @synapse/app` for installable preview APK
5. Optional: wire portal receipt print to shared `@synapse/db/receipt` snapshot (mobile already uses it)

## 13. APK build / version details
| Field | Value |
|-------|-------|
| name | Synapse |
| package | `tech.synapseos.app` |
| version | 1.1.0 |
| versionCode | 2 |
| EAS projectId | `547aa81a-9d93-447e-afc3-16f10eee6cb9` |
| preview profile | APK, internal distribution |
| Camera permission | present (barcode) |
| Installable APK this run | **not produced** |

## 14. Web deployment readiness
- Production build succeeds; routes under `/portal/*` present
- Env in agent is placeholder — deploy must use real Supabase URL + service role on server only
- No mock metrics presented as live except historically removed `pendingOrders: 0` (now real)

## 15. Exact commits / files (this branch vs main)
Key commits on `cursor/pharmacy-pilot-v1-9386`:
- inventory RPC convergence + hardening migration
- portal camelCase serializers + dashboard fix
- portal receiving UX
- native Expo screens + mobile BFFs + expo-camera
- batch CRUD via receive RPC + pilot docs/tests
- (plus POS draft/pending-sync follow-up)

See `git log main..HEAD --oneline` and PR #35 diff for full file list.

## 16. Recommended next SYNAPSE milestone
**“Pharm Pilot Live Cutover”**: apply migrations → revoke/verify RPC grants → seed/run smoke → EAS preview APK → install on 1–2 pilot pharmacies with supervised receive→FEFO sale→receipt→quarantined refund loop.
