-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260725102530  name: pharmacy_capability_roles
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.

-- Align pharmacy_user_settings.pharmacy_role with app capability roles.
ALTER TABLE public.pharmacy_user_settings
  DROP CONSTRAINT IF EXISTS pharmacy_user_settings_pharmacy_role_check;

ALTER TABLE public.pharmacy_user_settings
  ADD CONSTRAINT pharmacy_user_settings_pharmacy_role_check
  CHECK (
    pharmacy_role = ANY (
      ARRAY[
        'pharmacy_ceo'::text,
        'pharmacy_admin'::text,
        'pharmacy_staff'::text,
        'pharmacy_cashier'::text,
        'pharmacist'::text,
        'inventory_officer'::text,
        'pharmacy_store_manager'::text,
        'finance'::text
      ]
    )
  );
