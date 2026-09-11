-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260611141830  name: pharmacy_rls_fix_locked_tables
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.


-- Migration 1c: Fix RLS policies on tables that have RLS enabled but 0 policies

-- pharmacy_credit_ledger
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'pharmacy_credit_ledger' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY "tenant_isolation" ON pharmacy_credit_ledger
      FOR ALL USING (
        tenant_id IN (
          SELECT tenant_id FROM profiles WHERE id = auth.uid()
          UNION
          SELECT id FROM tenants WHERE EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'platform_admin'
          )
        )
      );
  END IF;
END $$;

-- pharmacy_expenses
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'pharmacy_expenses' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY "tenant_isolation" ON pharmacy_expenses
      FOR ALL USING (
        tenant_id IN (
          SELECT tenant_id FROM profiles WHERE id = auth.uid()
          UNION
          SELECT id FROM tenants WHERE EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'platform_admin'
          )
        )
      );
  END IF;
END $$;

-- pharmacy_staff_permissions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'pharmacy_staff_permissions' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY "tenant_isolation" ON pharmacy_staff_permissions
      FOR ALL USING (
        tenant_id IN (
          SELECT tenant_id FROM profiles WHERE id = auth.uid()
          UNION
          SELECT id FROM tenants WHERE EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'platform_admin'
          )
        )
      );
  END IF;
END $$;

-- pharmacy_import_sessions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'pharmacy_import_sessions' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY "tenant_isolation" ON pharmacy_import_sessions
      FOR ALL USING (
        tenant_id IN (
          SELECT tenant_id FROM profiles WHERE id = auth.uid()
          UNION
          SELECT id FROM tenants WHERE EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'platform_admin'
          )
        )
      );
  END IF;
END $$;
