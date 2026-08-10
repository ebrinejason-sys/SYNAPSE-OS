# SYNAPSE Pharm — Pilot-Ready v1

**Executive status: GREEN for enrollment (ops loop live)**

Branch merged to `main` · Last updated: 2026-08-10 (enrollment day).

Pilot code is on **main**, live inventory-authority RPCs are applied, and production
`www.synapseos.tech` mobile BFFs used by the APK return auth errors (not 404). Complete
the 18-step smoke on the enrolled tenant after admin credentials exist.

---

## 1. Executive status

| Gate | Status |
|------|--------|
| Merged to `main` | ✅ |
| Web / pharmacy CI verify | ✅ (latest main) |
| Android installable APK (EAS preview) | ✅ v1.2.1 / versionCode **5** · [download APK](https://expo.dev/artifacts/eas/8_5SZGbtsQZJX5HcHvWyUxzssrJ2ny-nNrSAVH7YJBc.apk) |
| Live inventory-authority migrations | ✅ applied to `qfqakzmjatszisuqjwon` |
| Live printer + receipt identity prefs | ✅ applied |
| APK BFF routes on www (no 404) | ✅ probed 2026-08-10 — see §17 |
| Tenant smoke (receive → sale → receipt → refund) | ⬜ run on enrolled pharmacy today |

---

## 2. Web / portal
- `@synapse/pharmacy` type-check, tests, production build verified in CI
- POS complete-sale via RPC; receive / adjust / refund converged on authority RPCs
- Portal reports null-safe; inventory category sums emit `_sum` / `_count` shapes
- Receipt HTML: IBM Plex Mono/Sans, paper width + font scale from pharmacy settings
- Production: `https://pharm.synapseos.tech` (portal) + `https://www.synapseos.tech` (APK BFF)

## 3. Android
- API base: `https://www.synapseos.tech`
- Flows: home, POS, stock, receive, import, sales, receipt, suppliers, POs, reports, refunds, settings, users, barcode
- Dark/light/system theme; forgot + reset password; More hub
- APK: [v1.2.1 / versionCode 5](https://expo.dev/artifacts/eas/8_5SZGbtsQZJX5HcHvWyUxzssrJ2ny-nNrSAVH7YJBc.apk)

## 4. Database (live `SYNAPSE_OS` / `qfqakzmjatszisuqjwon`)
Applied via Supabase MCP on enrollment day:
- `pharmacy_printer_preferences`
- `pharmacy_settings_receipt_identity`
- `pharmacy_inventory_authority` — batch `status`, summary view, `receive_pharmacy_stock`, FEFO sale
- `pharmacy_stock_authority_and_perms` — `adjust_pharmacy_stock`, grants
- `pharmacy_rls_tenant_isolation`
- `pharmacy_pilot_authority_hardening` — extended receive, `adjust_pharmacy_batch_stock`, `reverse_pharmacy_sale`, service_role-only EXECUTE

Verified present: `pharmacy_product_batches.status`, void columns on sales, all authority RPCs.

## 5. Security
- Privileged pharmacy RPCs: EXECUTE for `service_role` only (not anon/authenticated)
- APK/browser call server BFFs; BFFs use service role

## 6. Remaining for the enrolled pharmacy today
1. Create/onboard the tenant (portal or native onboarding) and staff login
2. Run `docs/release/PHARMACY_PILOT_SMOKE.md` (receive → FEFO sale → receipt → quarantined refund)
3. Confirm printer prefs (paper width / font scale / auto-print) for that store
4. Optional: set GitHub `VERCEL_TOKEN` if CLI deploy job should run; production currently ships via Vercel Git integration

## 7. Features deferred
- Native billing UI (portal link)
- Full offline inventory ledger
- EFRIS fiscal receipts
- Blind re-sell of returned meds (refunds default quarantined)

## 8–11. Builds / smoke procedure
See `docs/release/PHARMACY_PILOT_SMOKE.md`. Domain FEFO unit tests remain the offline proxy; live smoke is tenant-specific.

## 12. CI notes
- `verify` job is the gate (web + pharmacy + migrations check)
- `deploy-vercel` runs only when `secrets.VERCEL_TOKEN` is non-empty (empty token previously failed the workflow)
- `db-push` remains gated on `ENABLE_DB_PUSH=true`

## 13. APK build / version
| Field | Value |
|-------|-------|
| name | Synapse |
| package | `tech.synapseos.app` |
| version | **1.2.1** |
| versionCode | **5** |
| EAS projectId | `547aa81a-9d93-447e-afc3-16f10eee6cb9` |
| Installable APK | [download](https://expo.dev/artifacts/eas/8_5SZGbtsQZJX5HcHvWyUxzssrJ2ny-nNrSAVH7YJBc.apk) |

## 14–16. Deployment
- `main` is the enrollment branch
- www mobile pharmacy BFFs + auth mobile routes probed live (auth 401/400/200 — **not** 404)
- Pharm portal responds 200 / reports redirect 307 when unauthenticated

## 17. APK route probe (www.synapseos.tech, unauthenticated)
All critical paths used by the app returned **non-404** (401/400/200 as expected without a session):

- `/api/auth/mobile/{login,otp-verify,me,logout,forgot-password,reset-password,change-password}`
- `/api/mobile/dashboard`, `/api/mobile/inventory`, `/api/mobile/push-token`
- `/api/mobile/pharmacy/{pos/products,pos/complete-sale,settings,receiving,refunds,reports,users,suppliers,purchase-orders,onboarding,billing,sales,orders,interactions,inventory/bulk-upload}`

## 18. Recommended enrollment checklist (today)
1. Install APK 1.2.1 on the pharmacy device  
2. Complete onboarding / invite pharmacy-admin  
3. Receive one real batch (batch no + expiry)  
4. Sell one unit via POS → print/share receipt  
5. Refund/void with quarantined restore  
6. Open portal reports + native reports once  
