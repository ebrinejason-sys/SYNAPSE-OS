-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260604163152  name: custom_jwt_tenant_hook
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
  SELECT tenant_id INTO v_tenant_id
  FROM public.profiles
  WHERE id = (event->>'user_id')::UUID;

  IF v_tenant_id IS NOT NULL THEN
    RETURN jsonb_set(event, '{claims,tenant_id}', to_jsonb(v_tenant_id::text));
  END IF;
  RETURN event;
END;
$$;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
