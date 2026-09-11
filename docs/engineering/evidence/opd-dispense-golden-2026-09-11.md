# OPD → dispense golden journey evidence (2026-09-11)

## Scope
Domain-layer executable proof for the hospital pharmacy bridge:

`encounter opened → triage completed → prescription placed → verified → dispensed`

plus fail-closed checks for insufficient stock and already-dispensed re-entry.

## How to run
```bash
npx tsx --test packages/db/src/prescription-bridge.test.ts packages/db/src/opd-dispense-golden.test.ts
```

## What this proves
- Prescription and dispense permissions stay separated (`doctor` cannot dispense; `pharmacist` can).
- Dispense requires prior verification and refuses self-dispense by the prescriber.
- Stock is decremented exactly once on success; insufficient stock fails closed.
- A second dispense attempt on an already-dispensed Rx fails closed.
- Journey events share one `correlationId` (the encounter id).

## What this does not yet prove
- Live HTTP route auth/capability gates against production Supabase.
- Authoritative `pharmacy_products` / batch RPC decrement in a real tenant DB (covered separately by `hospital-dispense-idempotency.integration.test.ts` when `hasDb`).
- Billing invoice + timeline persistence side effects on the HTTP dispense route.

## Follow-ups
1. Optional: route-level vitest with mocked `requireHospitalStaffContext` for `/api/opd/prescriptions` + `/api/hospital/pharmacy/dispense`.
2. Live synthetic tenant journey once a pilot hospital + pharmacy pair is available.
