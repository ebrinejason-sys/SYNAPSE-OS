\set ON_ERROR_STOP 0
begin;
insert into tenants(id,name,slug) values ('aaaaaaaa-0000-4000-8000-000000000001','ZZ Synthetic A','zz-synth-a'),('bbbbbbbb-0000-4000-8000-000000000001','ZZ Synthetic B','zz-synth-b');
insert into pharmacy_suppliers(id,tenant_id,name) values ('aaaaaaaa-0000-4000-8000-0000000000a1','aaaaaaaa-0000-4000-8000-000000000001','Sup A'),('bbbbbbbb-0000-4000-8000-0000000000b1','bbbbbbbb-0000-4000-8000-000000000001','Sup B');
insert into pharmacy_products(id,tenant_id,name,sku,price,cost_price) values ('aaaaaaaa-0000-4000-8000-0000000000f1','aaaaaaaa-0000-4000-8000-000000000001','Prod A','ZZ-A-1',100,50);
insert into pharmacy_purchase_orders(id,tenant_id,supplier_id,order_no,total_amount) values ('bbbbbbbb-0000-4000-8000-0000000000c1','bbbbbbbb-0000-4000-8000-000000000001','bbbbbbbb-0000-4000-8000-0000000000b1','ZZ-PO-B',1);
insert into pharmacy_stores(id,tenant_id,name) values ('bbbbbbbb-0000-4000-8000-0000000000d1','bbbbbbbb-0000-4000-8000-000000000001','Store B');
savepoint s;
select 'foreign_supplier', public.receive_pharmacy_stock(p_tenant_id=>'aaaaaaaa-0000-4000-8000-000000000001',p_product_id=>'aaaaaaaa-0000-4000-8000-0000000000f1',p_batch_number=>'B1',p_quantity=>5,p_expiry_date=>current_date+365,p_supplier_id=>'bbbbbbbb-0000-4000-8000-0000000000b1');
rollback to s;
select 'foreign_po', public.receive_pharmacy_stock(p_tenant_id=>'aaaaaaaa-0000-4000-8000-000000000001',p_product_id=>'aaaaaaaa-0000-4000-8000-0000000000f1',p_batch_number=>'B1',p_quantity=>5,p_expiry_date=>current_date+365,p_purchase_order_id=>'bbbbbbbb-0000-4000-8000-0000000000c1');
rollback to s;
select 'foreign_store', public.receive_pharmacy_stock(p_tenant_id=>'aaaaaaaa-0000-4000-8000-000000000001',p_product_id=>'aaaaaaaa-0000-4000-8000-0000000000f1',p_batch_number=>'B1',p_quantity=>5,p_expiry_date=>current_date+365,p_store_id=>'bbbbbbbb-0000-4000-8000-0000000000d1');
rollback to s;
select 'own_supplier_ok', public.receive_pharmacy_stock(p_tenant_id=>'aaaaaaaa-0000-4000-8000-000000000001',p_product_id=>'aaaaaaaa-0000-4000-8000-0000000000f1',p_batch_number=>'B1',p_quantity=>5,p_expiry_date=>current_date+365,p_supplier_id=>'aaaaaaaa-0000-4000-8000-0000000000a1')->>'ok';
select 'batches_for_A', count(*) from pharmacy_product_batches where tenant_id='aaaaaaaa-0000-4000-8000-000000000001';
rollback;
