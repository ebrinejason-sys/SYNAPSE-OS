-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260810093434  name: pharmacy_rls_tenant_isolation
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.

-- =============================================================================
-- Defense-in-depth RLS + tenant isolation for core pharmacy operational tables.
--
-- The server clients (Web + Expo BFF) use the Supabase service role, which BYPASSES
-- RLS, so enabling RLS here does NOT change app behaviour. It closes direct
-- anon/authenticated access so one pharmacy can never read/modify another's data
-- if a table is ever queried with a non-service key.
--
-- ADDITIVE + REVERSIBLE and fully guarded: only acts on tables that exist, only
-- creates a policy when absent. Relies on the existing current_tenant_id() /
-- is_platform_admin() helpers (see 20260612000003_rls_helper_functions.sql).
--
-- REVIEW before `supabase db push`: confirm each listed table exists in the live
-- schema and carries a `tenant_id uuid` column (all pharmacy operational tables do).
--
-- Rollback: `alter table <t> disable row level security;` and drop the named policy.
-- =============================================================================

do $$
declare
  t text;
  pharmacy_tables text[] := array[
    'pharmacy_products',
    'pharmacy_product_batches',
    'pharmacy_product_packages',
    'pharmacy_pos_sales',
    'pharmacy_pos_sale_items',
    'pharmacy_stock_adjustments',
    'pharmacy_suppliers',
    'pharmacy_purchase_orders',
    'pharmacy_purchase_order_items',
    'pharmacy_settings',
    'pharmacy_stores',
    'pharmacy_user_settings'
  ];
  has_tenant boolean;
begin
  foreach t in array pharmacy_tables loop
    -- Only touch tables that actually exist with a tenant_id column.
    if to_regclass('public.' || t) is null then
      continue;
    end if;
    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = t and column_name = 'tenant_id'
    ) into has_tenant;
    if not has_tenant then
      continue;
    end if;

    execute format('alter table public.%I enable row level security', t);

    if not exists (
      select 1 from pg_policies where schemaname = 'public' and tablename = t
        and policyname = t || '_tenant_isolation'
    ) then
      execute format(
        'create policy %I on public.%I for all using (tenant_id = current_tenant_id() or is_platform_admin()) with check (tenant_id = current_tenant_id() or is_platform_admin())',
        t || '_tenant_isolation', t
      );
    end if;
  end loop;
end $$;
