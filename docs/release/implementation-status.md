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

## Phase status
| Phase | Scope | Status |
|-------|-------|--------|
| 0 | Audit & baseline | ✅ + live recheck 2026-08-07/10 |
| 1 | Pharmacy data correctness | 🟡 code+tests+migrations ready; **live schema still pre-authority** |
| 2 | Fully-native pharmacy app | 🟡 core ops native; billing still portal |
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

## Lint note
Repo-wide eslint ajv/`@eslint/eslintrc` breakage remains a pre-existing main issue — not introduced here.
