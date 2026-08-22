# SYNAPSE Pharm — Production Readiness

**Recommendation: YELLOW — CONTROLLED PILOT ONLY**

This is not GREEN. In-repo gates can pass without a live tenant smoke, without EAS APK
from this checkout, and without physical-device restart proof for offline POS.

Stacked PRs: A `#42` → B `#43` → C `#44` → E `#45` → D `#46` → F `#47` → H (this).

Do not merge competing `#36` (`packages/offline`) or `#34` (superseded inventory).
Do not in-place-edit shipped SQL from `#38`.

---

## Current version

| Surface | Version |
| ------- | ------- |
| Web / pharmacy portal | `@synapse/pharmacy` 1.0.0 · Next 15 |
| Mobile / APK | Expo app `1.2.2` / Android `versionCode` 6 · SDK 52 |
| Database migration level (repo) | Latest additive: `20260822120000_generate_synapse_id_person_compat.sql` (identity compat). Transfers execute: `20260819120000_pharmacy_stock_transfers_execute.sql`. Inventory authority: `20260810120000_pharmacy_pilot_authority_hardening.sql` |
| Live project | `qfqakzmjatszisuqjwon` — **this agent did not apply SQL** |

Release command:

```bash
npm run verify:pharm-release
```

---

## Capability table

Statuses: `PLANNED` / `PARTIAL` / `PILOT_READY` / `OPERATIONAL`.
`OPERATIONAL` requires implementation + tests + security review + live backend + failure-mode proof.

| Capability | Web | Android | Offline | Tested | Security reviewed | Status |
| ---------- | --- | ------- | ------- | ------ | ----------------- | ------ |
| Onboarding (org/store/staff) | NATIVE | NATIVE | no | partial | partial | PARTIAL |
| Roles / API authz | NATIVE | NATIVE (role set) | n/a | yes (unit) | partial | PARTIAL |
| Catalogue | NATIVE | NATIVE | cached snapshot | yes (qty side-doors) | partial | PARTIAL |
| Receiving / GRN | NATIVE | NATIVE | blocked | RPC helpers | partial | PARTIAL |
| Batch inventory / FEFO | NATIVE | NATIVE | local reservation | yes | partial | PARTIAL |
| Stock adjust | NATIVE | NATIVE | blocked | yes | partial | PARTIAL |
| Stock transfers | NATIVE | NATIVE (list/ship/receive) | blocked | yes (API unit) | partial | PARTIAL |
| POS sale | NATIVE | NATIVE | cash + unverified card/momo | yes (RPC + outbox) | partial | PARTIAL |
| Payments | internal status | internal status | cash captured; card/momo unverified | partial | partial | PARTIAL |
| Receipts / print / share | NATIVE | NATIVE (print/share) | pending-sync marker | domain tests | n/a | PARTIAL |
| Refunds | reverse RPC → quarantine | NATIVE | blocked | RPC | partial | PARTIAL |
| Durable offline POS | online-only (honest) | SQLite outbox | single-counter | unit A/C/D/F | partial | PARTIAL |
| Sync / conflict UI | n/a | NATIVE | yes | unit | n/a | PARTIAL |
| Reports / export | NATIVE | NATIVE | no | partial | unreviewed | PARTIAL |
| Till open/close | unwired | unwired | n/a | no | n/a | PLANNED |
| Encrypted device DB | n/a | sandbox only | n/a | no | no | PLANNED |
| Multi-counter offline | n/a | n/a | n/a | n/a | n/a | PLANNED |

Authoritative file: `docs/implementation/capability-registry.json`.

---

## Test evidence

`npm run verify:pharm-release` on `cursor/pharm-release-gate-bf39` (2026-08-22):

```text
[db:check] 43 migration files OK
Test Files  17 passed (17)
Tests  148 passed (148)

  PASS     db:check (migration integrity)
  PASS     lint @synapse/web
  PASS     lint @synapse/pharmacy
  PASS     type-check @synapse/web
  PASS     type-check @synapse/pharmacy
  PASS     type-check @synapse/app
  PASS     test @synapse/pharmacy (unit/domain/authz/contracts)
  PASS     build @synapse/pharmacy
  PASS     verify:web (type-check + Next build)
  PASS     expo export --platform android
  SKIPPED  live RLS/RPC probes (live Supabase credentials are not available in this environment)
  SKIPPED  eas android apk (EXPO_TOKEN unset — cannot authenticate EAS)

RELEASE_GATE=PASS_WITH_SKIPS
```

The command **fails** if a required step fails. Skips are printed as `SKIPPED`, never as `PASS`.
`PASS_WITH_SKIPS` is why this report is YELLOW, not GREEN.

### Offline cases (automated)

| Case | Coverage |
| ---- | -------- |
| A — sale commits, HTTP lost, retry | Apply classifier retries 5xx; server idempotency + commandId replay. Unit: interrupted apply replays, no second row. |
| B — app killed after offline sale | SQLite persist-before-UI; restart recovers `queued`. Unit: database/module restart. **Physical device still required.** |
| C — crash before local ACK | `applied` remains listReady; flush replays. Unit. |
| D — cached 5, sell 3, sell 3 | Second persist throws `INSUFFICIENT_STOCK` sellable=2. Unit. |
| E — server stock changed | Apply maps `INSUFFICIENT_STOCK` to `rejected` (not overwrite). Unit classifier. **Live probe not run.** |
| F — same commandId, different hash | `human_review` conflict. Unit. |

### Physical device smoke (not executed here)

Follow `docs/release/PHARMACY_PILOT_SMOKE.md` plus:

1. Airplane mode → cash sale → force-stop app → reopen → Sync status shows Pending sync.
2. Restore network → Retry sync now → one receipt on web and Android.
3. Repeat sale with same command after killing mid-sync → still one sale.

---

## Pilot evidence

Live 18-step smoke against a real tenant was **not** executed in this cloud environment
(no operator-approved `supabase db push`, no EAS login, placeholder-or-absent live keys
for a disposable probe).

Existing enrollment APK (`v1.2.1` / versionCode 5) is superseded by repo `v1.2.2` / versionCode 6. Rebuild the APK from `main` before calling
the offline outbox “in the field.”

---

## Security notes (pharmacy sweep)

Fixed or already constrained in this stack:

- Batch inventory is the write authority; catalogue/onboarding/order paths no longer
  treat `pharmacy_products.quantity` as independently writable (PR C).
- Mobile transfer/receive writes require `canMutatePharmacyInventory` — tenant_id alone
  is not enough (PR F).
- Sync apply checks tenant + actor + command type; payload hash is SHA-256 only.
- Expo ships the public anon key only (`app.json`). No service-role on device.

Still open (do not call OPERATIONAL):

- Live RLS / RPC grant probes against production.
- Store-scope helper `packages/db/src/scope.ts` is not consistently enforced on every
  list endpoint.
- Middleware anon fallback (historical) needs a dedicated review.
- `adjust_pharmacy_stock` orphaned grants if present on live.
- SQLite is not SQLCipher.
- Dual financial ledgers (`pharmacy_pos_sales` vs `pharmacy_transactions`).

---

## Known limitations

- Till / cashier session open-close is unwired.
- Dual sale ledgers remain.
- Transfer create on Android uses product id, not a search picker.
- Offline is single-device / single-counter. No LAN edge.
- Card/mobile-money offline is explicitly unverified.
- Web POS refuses offline completion.
- Encrypted-at-rest local DB is not implemented.
- Schema drift vs live is documented, not continuously probed.
- EAS APK is not produced by this agent.

## Deferred features (not bugs)

- ICU / theatre / maternity / radiology / wards / national epi dashboards.
- Multi-counter offline authority.
- EFRIS fiscal receipts.
- SQLCipher.
- Full WCAG 2.2 AA audit with TalkBack lab evidence.
- Clinical FHIR/ICD operational UIs (out of Pharm milestone).

## Production recommendation

```text
YELLOW — CONTROLLED PILOT ONLY
```

Use a single counter, trained staff, cash-first offline, and an operator who can
apply pending migrations and rebuild the APK. Do not enable multi-store concurrent
offline selling. Do not market OPERATIONAL.

Promote to GREEN only after:

1. Live SQL apply of pending additive migrations on a staging clone, then production.
2. Full smoke in `docs/release/PHARMACY_PILOT_SMOKE.md` PASS against that backend.
3. Physical-device cases B and C.
4. EAS preview APK from the merged stack.
5. RLS/RPC grant probes on the live project.
