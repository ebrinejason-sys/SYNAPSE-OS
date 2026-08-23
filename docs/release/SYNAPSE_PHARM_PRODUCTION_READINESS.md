# SYNAPSE PHARM V1 PRODUCTION READINESS

Release: Synapse Pharm v1 candidate (not GREEN)
Commit: use `git rev-parse HEAD` — do not hard-code a stale SHA
APK: Expo 1.3.0 / Android versionCode 7 is the **intended** next build. Last **installable** APK remains 1.2.2 / vc6 from EAS `21af12b8` (older SHA)
Database: live `qfqakzmjatszisuqjwon` has transfer RPCs, till columns, identity compat
Date: 2026-08-23

## Gate summary

| Gate | Result |
|------|--------|
| GitHub CI | PASS on `a29a2ac` — `CI / verify` + `CI / pharm-release` ([run 32636533122](https://github.com/ebrinejason-sys/SYNAPSE-OS/actions/runs/32636533122)). `RELEASE_GATE=PASS` in Actions, not only Vercel. |
| Local release | PASS on `418e868` (`RELEASE_GATE=PASS`). Later commits on this branch are docs/evidence only. |
| DB parity | PASS |
| RLS | BLOCKED (policies exist; live JWT ID attacks not run) |
| RPC security | PASS (transfer RPCs service_role only) |
| Tenant isolation | BLOCKED |
| Store isolation | BLOCKED (unit PASS; live A1/A2 not run) |
| Web smoke | BLOCKED |
| Android smoke | BLOCKED |
| Offline A-H | BLOCKED |
| Printer | BLOCKED |
| Transfer | BLOCKED (RPCs live; operator proof missing) |
| Till reconciliation | BLOCKED (code PASS; operator missing) |
| Financial ledger | PARTIAL (POS-only default + unit test) |
| 18-step smoke | BLOCKED |

## Production recommendation

```text
YELLOW — CONTROLLED PILOT ONLY
```

GREEN is forbidden while any required gate is BLOCKED or FAIL.
