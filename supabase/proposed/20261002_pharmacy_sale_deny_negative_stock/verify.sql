-- Read-only checks after applying 20261002130000.
select position('NEG-STOCK'', 0, 0' in pg_get_functiondef(
  'public.complete_pharmacy_sale(uuid,uuid,jsonb,text,uuid,uuid,text,numeric,numeric,uuid,uuid,text)'::regprocedure)) = 0
  as overdraft_insert_removed;
select count(*) as neg_stock_batches_below_zero from public.pharmacy_product_batches
  where batch_number = 'NEG-STOCK' and quantity < 0;
select count(*) as products_below_zero from public.pharmacy_products where quantity < 0;
