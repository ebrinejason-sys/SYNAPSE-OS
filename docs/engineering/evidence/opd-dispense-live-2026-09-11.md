# Live synthetic OPD → dispense journey (2026-09-11)

## Result
PASS against production Supabase `qfqakzmjatszisuqjwon`.

Evidence JSON: `opd-dispense-live-2026-09-11T10-46-40-760Z.json`

## What ran
Hospital `synthetic-hospital-20260903` → pharmacy `pharm-synapse-pilot`:

1. Synthetic doctor + pharmacist profiles
2. Patient + OPD encounter
3. Seed product + `receive_pharmacy_stock` (20 units)
4. Place `clinical_prescriptions` + pharmacy department task
5. Domain verify/dispense + `complete_pharmacy_sale`
6. Assert stock decrement exactly once + idempotent re-sale
7. Cleanup synthetic rows

## Code fix included
`POST /api/hospital/pharmacy/dispense` now reads on-hand qty from `pharmacy_product_batches` (active batches). The previous `pharmacy_stock` table does not exist in production.

## How to re-run
```bash
npm run opd:dispense:live
# or
node scripts/opd-dispense-live-journey.mjs --project-ref qfqakzmjatszisuqjwon
```

Requires Supabase CLI auth (fetches service_role ephemerally) or `SUPABASE_SERVICE_ROLE_KEY` in env. Keys are never written to evidence.
