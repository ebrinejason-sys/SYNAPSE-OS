-- Traceability: replacement lab order after specimen rejection/recollect.
-- Nullable; applied on disposable/test first. Do not treat presence of this file as remote-applied.

ALTER TABLE public.lab_orders
  ADD COLUMN IF NOT EXISTS replaces_lab_order_id UUID NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'lab_orders_replaces_lab_order_id_fkey'
  ) THEN
    ALTER TABLE public.lab_orders
      ADD CONSTRAINT lab_orders_replaces_lab_order_id_fkey
      FOREIGN KEY (replaces_lab_order_id) REFERENCES public.lab_orders(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_lab_orders_replaces
  ON public.lab_orders (tenant_id, replaces_lab_order_id)
  WHERE replaces_lab_order_id IS NOT NULL;

COMMENT ON COLUMN public.lab_orders.replaces_lab_order_id IS
  'Prior rejected lab order this order recollects; preserves original specimen history.';
