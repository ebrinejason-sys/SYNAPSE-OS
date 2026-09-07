-- Apply the caller's table privileges and tenant RLS to inventory summaries.
-- Server-side service-role inventory operations retain their existing access.
ALTER VIEW public.pharmacy_inventory_summary SET (security_invoker = true);
