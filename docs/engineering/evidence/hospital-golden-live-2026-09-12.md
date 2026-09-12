# Hospital Golden Journey — live synthetic (2026-09-12)

## Result
**PASS** against pilot Supabase `qfqakzmjatszisuqjwon` (tenants `synthetic-hospital-20260903` → `pharm-synapse-pilot`).

Evidence JSON: `docs/engineering/evidence/hospital-golden-live-2026-09-12T18-48-12-759Z.json`

## Path proven
1. Create encounter with structured write-up in `metadata.writeup` + `clinical_note`
2. Seed pharmacy stock via `receive_pharmacy_stock` / `pharmacy_product_batches`
3. Prescribe → verify-required → dispense with stock decrement + idempotent re-sale
4. Record disposition in metadata (`LOCAL_PHARMACY`) — first-class columns pending migration apply
5. Sign encounter (`is_signed`)
6. Closeout assert + cleanup

## How to re-run
```bash
npm run journey:hospital-golden-live
# or
node scripts/hospital-golden-live-journey.mjs --project-ref qfqakzmjatszisuqjwon
```

## Notes
- Production trigger `ENCOUNTER_SIGNED_IMMUTABLE` blocks post-sign updates; live order is write-up → pharmacy → disposition → sign.
- Migration `20260912184600_encounter_disposition_columns.sql` adds durable disposition columns (apply on next production db push).
- Domain runner with optional lab branch: `npm run test:hospital-golden-journey`
- Inpatient admit/transfer/discharge foundation: `npm run test:inpatient-lifecycle`
