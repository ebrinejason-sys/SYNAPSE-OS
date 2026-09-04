-- Ensure the tenants trigger uses the public function, not a same-named
-- function from another schema on the production search_path.
DROP TRIGGER IF EXISTS update_tenants_updated_at ON public.tenants;

CREATE TRIGGER update_tenants_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();