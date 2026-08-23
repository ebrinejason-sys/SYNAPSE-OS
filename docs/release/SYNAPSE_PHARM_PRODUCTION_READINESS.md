# SYNAPSE PHARM V1 PRODUCTION READINESS

Release: Synapse Pharm v1 candidate (**YELLOW — CONTROLLED PILOT ONLY**)
Tested commit: `6b27722905c92350423e09ba97f0a4ca1ae42155`
APK: Expo **1.3.0 / Android versionCode 7** — EAS `e224e216-af11-48de-ac15-50aa5947e653` **FINISHED** from that SHA. Physical install/upgrade still **BLOCKED**.
Database: live `qfqakzmjatszisuqjwon` previously verified for transfer RPCs + till columns (this agent did not re-probe live SQL)
Date: 2026-08-23

## Gate summary

| Gate | Result |
|------|--------|
| Local `verify:pharm-release` | PASS |
| GitHub CI | PASS (`CI / verify` + `CI / pharm-release` on run 32648604155; Vercel is not the Pharm gate) |
| APK build | PASS (EAS preview FINISHED; install still BLOCKED) |
| DB parity | PASS (prior live apply; not re-run here) |
| RLS | PARTIAL (policies exist; live JWT isolation not run) |
| RPC security | PARTIAL (migrations revoke anon/authenticated; live GRANT probe needs anon key) |
| Tenant isolation | BLOCKED (no tenant A/B JWTs) |
| Store isolation | PARTIAL (shared `requireStoreScope` + unit tests; live store proof not run) |
| Web smoke | BLOCKED |
| Android smoke | BLOCKED |
| Offline A–H | BLOCKED |
| Printer | BLOCKED |
| Stock transfer | PARTIAL (RPCs + routes; no live two-store proof) |
| Till reconciliation | PARTIAL (lifecycle + APIs + UI; no operator close) |
| Financial ledger | PARTIAL (POS-only report totals in code/unit tests; no live 100000 proof) |
| 18-step smoke | BLOCKED |

## What this pass closed (code / local)

- GitHub Actions 0s failure: `secrets.*` in a job-level `if` invalidated the old `CI` workflow. New `ci.yml` publishes **CI / verify** and **CI / pharm-release**. `deploy.yml` is `Deploy` only.
- Store-assigned staff cannot pass `storeId` of another store on stock adjust, transfer create, or POS complete.
- Cashiers cannot close another cashier's till (`ACCESS_DENIED` unless variance-approver/admin).
- Legacy order refund warning no longer claims quantity restore. Regression: quantity delta 0, no batch, sellable unchanged.
- Sales reports total `pharmacy_pos_sales` only so one POS sale of 100000 is 100000, not 200000.
- Live script attacks known foreign IDs (read/update/refund/ship/receive) and fails closed without JWTs.
- APK version bumped to 1.3.0 / versionCode 7; EAS preview APK FINISHED (`e224e216`). Physical device install is still BLOCKED.

## Capability notes

Do not mark OPERATIONAL without matching evidence. `offline_durable_pos` stays PARTIAL until device B/C. `stock_transfers_execute` stays PARTIAL until a live two-store transfer. `cashier_till_sessions` stays PARTIAL until operator close/reconciliation. `multi_counter_offline` stays PLANNED.

## Security

- No service role in the APK source.
- Privileged sale/transfer RPCs are `service_role` only in migrations.
- Rotate any Expo token that was pasted in chat: https://expo.dev/settings/access-tokens
- Do not print JWTs, service-role keys, or Expo tokens in logs.

## Operator work that still blocks GREEN

1. After merge, require GitHub checks `CI / verify` and `CI / pharm-release` (not Vercel).
2. Run live isolation with real JWTs:

```bash
SYNAPSE_PHARM_LIVE=1 \
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<service-role> \
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon> \
SYNAPSE_PHARM_LIVE_TENANT_A_JWT=<tenant-a-user-jwt> \
SYNAPSE_PHARM_LIVE_TENANT_B_JWT=<tenant-b-user-jwt> \
SYNAPSE_PHARM_LIVE_A_PRODUCT_ID=<uuid> \
SYNAPSE_PHARM_LIVE_A_BATCH_ID=<uuid> \
SYNAPSE_PHARM_LIVE_A_SALE_ID=<uuid> \
SYNAPSE_PHARM_LIVE_A_TRANSFER_ID=<uuid> \
SYNAPSE_PHARM_LIVE_B_PRODUCT_ID=<uuid> \
SYNAPSE_PHARM_LIVE_B_BATCH_ID=<uuid> \
SYNAPSE_PHARM_LIVE_B_SALE_ID=<uuid> \
SYNAPSE_PHARM_LIVE_B_TRANSFER_ID=<uuid> \
npm run verify:pharm-live
```

3. Install EAS APK `e224e216` (1.3.0 / vc7) on a real Android device; confirm upgrade from 1.2.2/vc6 if applicable.
4. Execute `docs/testing/PHARM_OFFLINE_DEVICE_GREEN.md` cases A–H on that APK.
5. Execute `docs/testing/PHARM_PRINTER_GREEN.md` on one 80mm printer.
6. Fill every box in `docs/release/PHARMACY_PILOT_SMOKE.md`, plus two-store transfer and till close (exact + variance).
7. Confirm live inventory reconciliation has no critical discrepancies (do not auto-correct).

## Production recommendation

```text
YELLOW — REMAINING EXTERNAL VALIDATION BLOCKERS
```

GREEN is not allowed while live JWTs, physical APK install, printer, or operator smoke are missing.
