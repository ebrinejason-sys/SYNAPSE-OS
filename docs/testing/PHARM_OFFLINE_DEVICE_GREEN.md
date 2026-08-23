# Pharm offline device GREEN checklist

Physical Android proof is a release artifact. Unit tests do **not** satisfy these cases.

## Build under test

| Field | Value |
| ----- | ----- |
| Device model | BLOCKED — no physical Android in this environment |
| Android version | BLOCKED |
| APK version | last proven EAS: Expo 1.2.2 / versionCode 6 |
| EAS build ID | `21af12b8-2643-4f96-9ac1-9c742bed5220` (EAS-fix branch, not this GREEN SHA) |
| Build URL | https://expo.dev/accounts/ebrinejason/projects/synapse-app/builds/21af12b8-2643-4f96-9ac1-9c742bed5220 |
| Test date | 2026-08-23 |
| Tester | Cloud agent (code + instructions only) |

## Cases

| Case | Procedure | Expected | Result |
| ---- | --------- | -------- | ------ |
| A | Online sale, drop HTTP after server commit, retry same commandId | One server sale | BLOCKED |
| B | Airplane mode, cash sale, force-stop app, reopen | Pending sale survives | BLOCKED |
| C | Airplane mode, sale, reboot phone, reopen | Pending sale survives reboot | BLOCKED |
| D | Sync starts, kill app before local ACK, reopen | Replay produces one server sale | BLOCKED |
| E | Cached stock 5, offline sell 3, sell 3 | Second sale blocked `INSUFFICIENT_STOCK` | BLOCKED |
| F | Server stock changes before sync | Explicit conflict / rejected | BLOCKED |
| G | Same commandId, different payload hash | `HUMAN_REVIEW` | BLOCKED |
| H | Network flaps online/offline | No duplicate sales | BLOCKED |

Automated coverage for A/D/E/F/G exists in `apps/pharmacy/lib/platform`. B and C require a real device.

## Operator steps

1. Install the APK built from **merged main** (not Metro export).
2. Log in, open till, cache catalogue while online.
3. Execute A–H in order. Photograph Sync status after B and C.
4. Record PASS/FAIL in this table. A blank box keeps the release YELLOW.
