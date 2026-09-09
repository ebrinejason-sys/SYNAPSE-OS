-- Receipt numbers are tenant-local identifiers. The existing global constraint
-- prevented independent pharmacies from using the same daily sequence value.
ALTER TABLE public.pharmacy_pos_sales
  DROP CONSTRAINT IF EXISTS pharmacy_pos_sales_receipt_number_key;

CREATE UNIQUE INDEX IF NOT EXISTS pharmacy_pos_sales_tenant_receipt_number_uidx
  ON public.pharmacy_pos_sales (tenant_id, receipt_number);

COMMENT ON INDEX public.pharmacy_pos_sales_tenant_receipt_number_uidx IS
  'Receipt numbers are unique within a pharmacy tenant; independent tenants may reuse the same sequence value.';