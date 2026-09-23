-- Hide legacy public commercial catalog rows while preserving historical FKs.
-- Canonical public catalog remains:
--   synapse_pharmacy_annual, synapse_lab_annual, synapse_os_basic_annual,
--   synapse_os_lab_addon_annual, synapse_enterprise

UPDATE public.subscription_plans
SET
  public_visible = false,
  pricing_state = CASE
    WHEN pricing_state IN ('CUSTOM_QUOTE', 'COMING_SOON', 'ADD_ON', 'STARTING_AT', 'INCLUDED') THEN pricing_state
    ELSE 'HIDDEN'
  END,
  updated_at = now()
WHERE coalesce(public_visible, true) = true
  AND slug NOT IN (
    'synapse_pharmacy_annual',
    'synapse_lab_annual',
    'synapse_os_basic_annual',
    'synapse_os_lab_addon_annual',
    'synapse_enterprise'
  );
