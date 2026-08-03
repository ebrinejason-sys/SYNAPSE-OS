-- Align pharmacy_user_settings.pharmacy_role with app capability roles.
-- Legacy values (pharmacy_ceo, pharmacy_admin, pharmacy_staff) remain valid.

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

COMMENT ON CONSTRAINT pharmacy_user_settings_pharmacy_role_check
  ON public.pharmacy_user_settings IS
  'Capability roles used by apps/pharmacy/lib/capabilities.ts; pharmacy_staff aliases to cashier.';
