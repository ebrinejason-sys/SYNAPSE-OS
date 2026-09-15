-- At most one non-terminal replacement order per rejected original (per tenant).
-- Complements application checks; FK alone does not enforce this.

CREATE UNIQUE INDEX IF NOT EXISTS lab_orders_one_open_replacement_uidx
  ON public.lab_orders (tenant_id, replaces_lab_order_id)
  WHERE replaces_lab_order_id IS NOT NULL
    AND coalesce(workflow_status, '') NOT IN ('CANCELLED', 'REJECTED', 'RELEASED', 'AMENDED');

COMMENT ON INDEX public.lab_orders_one_open_replacement_uidx IS
  'Prevents concurrent duplicate recollection orders against the same rejected parent while a replacement is still open.';
