# Release 0 overnight cut — 2026-08-01

Implements chronological Release 0 steps 1–6 from `SYNAPSE_ECOSYSTEM_OPERATING_MODEL_2026.md` §21 (code + live DB inventory). **No git commit** per founder instruction. Vercel production deploy attempted after type-checks.

## Done in this cut

### 1 — Claims / freeze / journey
- Landing trust marquee, hero compliance chips, compare table, standards, FeatureTabs, footer, login/invite badges: **FHIR / offline-first / DHIS2** qualified as partial/roadmap.
- FHIR HTTP stubs return **501 OperationOutcome** (not “active”).
- This report + identity decision + freeze note below.

### 2 — OS P0 safety
- `POST /api/health/coach` — session required; `userId` from JWT only.
- `POST /api/health/diet-analyze` — session required.
- `POST /api/tele/intake` — persists only for authenticated session subject.
- `POST /api/encounters` — **410 Gone**; canonical `POST /api/opd/triage`.

### 3 — Pharm leftovers
- Profit report reads **POS ledger** via `listLedgerSalesForHistory` (date window).
- POS edit/delete → **409 APPEND_ONLY**; UI hides edit for `source === "pos"`.
- Subscription lock → **degraded read** allowlist (history/inventory/reports/dashboard) vs blocked POS/refunds/purchases/users.

### 4 — Expo App P0
- Cache namespaced by user id; **purged on logout**; no cache without known user.
- Lock **fail-closed** (no biometrics → logout; catch does not unlock).
- Push copy discreet (queue / stock / appointment / lab) — no PHI on lock screen.

### 5 — Core inventory (live `qfqakzmjatszisuqjwon`)
- Public tables present include: `pharmacy_pos_sales` (1), `pharmacy_sale_idempotency`, `synapse_sessions` (41), `tenants` (4), `profiles` (10), hospital clinical tables at 0 rows.
- Identity decision: keep **custom `synapse_session` JWT** as primary for web/pharmacy/mobile; Supabase Auth remains migration fallback only — converge membership model in Release 1.

### 6 — Platform admin
- Existing `/platform/health` already counts `pharmacy_pos_sales`; no fake POS metrics added.

## Freeze
Do **not** add new hospital module shells or FHIR “live” claims until Release 0 exit gate.

## First journey (Release 2 target)
App request → OS registration/OPD → Pharm dispense → App follow-up.

## Still open
- Mobile patient/queue BOLA capability tightening.
- Clinical facade “Coming soon” labels at scale.
- App `@types/react` isolation + CI job.
- Full `/platform/app` hub.
- Encrypt AsyncStorage (namespace+purge shipped; encryption deferred).

## Deploy
- **Web (synpase-os):** production READY — https://synapseos.tech (also www / app / admin). Deployment `dpl_Ad4dLRzFMU7xcGURGKc2c3VbANUv`.
- **Pharmacy (synapse-pharm):** production READY — https://pharm.synapseos.tech. Deployment `dpl_9ncUX6amBSPMVvGz5Dhj3QdgiiKx`.
- **DB:** no new DDL required for this cut (POS idempotency already live). Live inventory snapshot taken via Supabase MCP.
- **Expo:** code updated in repo; APK/EAS store build not run (needs device/EAS when awake).
- **Git:** no commit (per instruction).
