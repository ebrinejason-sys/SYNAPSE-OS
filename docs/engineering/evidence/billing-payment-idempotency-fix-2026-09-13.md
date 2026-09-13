# Billing payment idempotency order fix (2026-09-13)

## Defect

`recordEncounterPayment` threw `INVOICE_ALREADY_PAID` on retry with the same `idempotency_key` after the first collection marked the invoice paid.

## Fix

In `packages/db/src/clinical-payment.ts`, resolve matching `billing_payments` row by `(tenant_id, idempotency_key)` **before** the balance-due / `INVOICE_ALREADY_PAID` gate.

## Proof

`apps/pharmacy/lib/platform/hospital-billing-payment.integration.test.ts` PASS on disposable-rc1 (`:54322`).
