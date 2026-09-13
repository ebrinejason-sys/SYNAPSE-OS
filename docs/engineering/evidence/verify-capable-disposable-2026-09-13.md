# Verify-capable disposable schema (2026-09-13)

Branch: `feat/rc1-lab-offline-acceptance`  
Disposable: `synapse-rc1-lab-*` + PostgREST `:54321` + REST proxy `:54322` + Next `:3011`  
Bootstrap: `scripts/db-tests/verify-capable-bootstrap.sql` (extends lab-rc1 bootstrap)

## Why

Fresh migration-replay from empty Postgres still fails early (missing `profiles` / `auth.*` — see `migration-replay-disposable-2026-09-13.md`). RC1 acceptance therefore expands the **labeled disposable** schema until env-coupled pharmacy/hospital integration tests can run against it.

## Added for verify-capable path

- Patient/hospital/pharmacy catalog columns (`dob`, `full_name`, `sex`, `facility_kind`, products/suppliers)
- `clinical_prescriptions`, `department_tasks`, `pharmacy_product_batches`
- RPCs: `receive_pharmacy_stock`, `complete_pharmacy_sale` (+ POS sales / sale items / sale idempotency)
- Encounter cols: `is_deleted`, `clinician_id`, `visit_date`
- Billing: `billing_invoices`, `billing_line_items`, `billing_payments`
- Exchange: `synapse_domain_events`

## Results (pointed at disposable via `apps/web/.env.local` → `:54322`)

| Suite | Result |
|-------|--------|
| `hospital-dispense-idempotency.integration.test.ts` | PASS |
| `hospital-billing-payment.integration.test.ts` | PASS (after idempotency-order fix) |
| `malaria-golden-journey.integration.test.ts` | PASS |
| RC1 HTTP+DB failure matrix (`scripts/rc1-failure-matrix.mjs`) | 12/12 PASS (prior) |

## Code fix uncovered by billing suite

`packages/db/src/clinical-payment.ts` — `recordEncounterPayment` checked `INVOICE_ALREADY_PAID` **before** idempotency-key lookup, so a legitimate retry after a successful cash collection threw. Idempotency lookup now runs first.

## Still open

- Facility-switch **browser** E2E (second facility session cookie)
- Full `npm run verify` may still hit other env-coupled suites beyond this trio; treat verify-capable as **expanded for RC1 lab/offline + these pharmacy ints**, not a claim that every historical migration replays from zero
- Production untouched; feat branch not pushed until release-gate decision
