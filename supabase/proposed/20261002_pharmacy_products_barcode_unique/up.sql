-- PROPOSED (not in supabase/migrations; NOT applied to production).
-- One barcode per pharmacy so a POS scan resolves to exactly one product.
-- Pre-check 2026-10-02: duplicate (tenant_id, btrim(barcode)) groups = 0 in prod
-- (10 rows carry a barcode) and 0 locally. Re-run the pre-check below right before
-- applying; CONCURRENTLY avoids locking pharmacy_products for writes.
--
-- select tenant_id, btrim(barcode), count(*) from pharmacy_products
--  where barcode is not null and btrim(barcode) <> '' group by 1,2 having count(*) > 1;

create unique index concurrently if not exists pharmacy_products_tenant_barcode_uniq
  on public.pharmacy_products (tenant_id, btrim(barcode))
  where barcode is not null and btrim(barcode) <> '';
