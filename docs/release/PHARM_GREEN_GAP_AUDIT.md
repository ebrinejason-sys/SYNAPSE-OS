# Pharm GREEN gap audit

Audited: 2026-08-23  
Start SHA: `e87e8f8a589cfca25b4b9bb78cf06c920398a75f`  
Working branch: `cursor/pharm-v1-green-prove-bf39`  
Final candidate SHA is `git rev-parse HEAD` after this branch merges. Do not treat this file’s start SHA as the release SHA.

| Gate | Current evidence | Missing evidence | Owner | Status |
| ---- | ---------------- | ---------------- | ----- | ------ |
| Local `verify:pharm-release` | `RELEASE_GATE=PASS` on `418e868` (db/lint/typecheck/test/builds/expo export) | Re-run if source SHA changes | release | PASS |
| GitHub Actions CI | `CI / verify` + `CI / pharm-release` success on `a29a2ac` ([run 32636533122](https://github.com/ebrinejason-sys/SYNAPSE-OS/actions/runs/32636533122), 11m57s, `RELEASE_GATE=PASS` in CI). Vercel is extra, not the gate. | Re-require both checks on `main` after merge. Re-run if source SHA changes. | release | PASS |
| DB parity | Live has ship/receive RPCs, till columns, identity compat | Re-verify after any new migration | db | PASS |
| RLS present | Critical Pharm tables have RLS from prior migrations | Live JWT attack by foreign IDs | security | BLOCKED |
| RPC security | Transfer RPCs: anon/auth execute false, service_role true | Same grant matrix recorded in live probe log for this SHA | security | PASS |
| Tenant isolation | List-overlap probe existed; now adversarial ID attacks | Tenant A/B JWTs + fixture IDs | security | BLOCKED |
| Store isolation | Unit attacks for storeId=A2; ship/receive/stock/transfer create scoped | Live A1 vs A2 with assigned user | security | BLOCKED |
| Current-main EAS APK | Last APK is 1.2.2 / vc6 from earlier SHA | EAS build of 1.3.0 / vc7 from final SHA | mobile | BLOCKED |
| Offline device A–H | Unit coverage for A/D/E/F/G | Physical B/C and full A–H on final APK | qa | BLOCKED |
| 80mm printer | Checklist only | Real printer run | qa | BLOCKED |
| 18-step smoke | Procedure exists | Operator PASS on every box | qa | BLOCKED |
| Stock transfer live | RPCs live | Two-store ship/receive proof | qa | BLOCKED |
| Till close | APIs + UI | Operator open/sale/close/variance | qa | BLOCKED |
| Financial authority | POS-only default + unit test | Controlled 100,000 live report | finance | BLOCKED |
| Evidence SHA | `npm run evidence:pharm-green` writes `git rev-parse HEAD`. Writer landed in `1f02326`. | Re-stamp after every source SHA change | release | PASS |
| Secrets / Expo token | Token pasted historically | Rotation confirmation | security | BLOCKED |

Allowed statuses: PASS / FAIL / BLOCKED. This audit is not a GREEN recommendation.
