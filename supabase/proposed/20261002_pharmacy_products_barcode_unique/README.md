# PROPOSED — unique barcode per pharmacy

**Status: applied LOCALLY only to verify. NOT applied to production.** Not placed in
`supabase/migrations` on purpose; promote it after review.

- App-level guard already ships: `apps/pharmacy/lib/barcode.ts` (inventory POST/PATCH → 409
  `DUPLICATE_BARCODE`; bulk upload skips duplicate barcodes; a 23505 maps to 409).
- Duplicate pre-check (2026-10-02): **prod 0 groups** (10 products have a barcode, case/trim
  insensitive check also 0); **local 0 groups**.
- `up.sql` uses `CREATE UNIQUE INDEX CONCURRENTLY` (run outside a transaction);
  `down.sql` drops it.
