-- Rollback for the PROPOSED plan feature seed. Removes exactly the mapped
-- (plan slug, feature) pairs. Production had zero plan_features on these three
-- plans before the seed, so this restores the prior state. The registry row is
-- left in place (it pre-exists in production and is not owned by this seed).
BEGIN;
DELETE FROM public.plan_features pf
USING public.subscription_plans sp
WHERE pf.plan_id = sp.id
  AND (sp.slug, pf.feature_key) IN (
    ('synapse_os_basic_annual','registration'), ('synapse_os_basic_annual','opd'),
    ('synapse_os_basic_annual','billing'), ('synapse_os_basic_annual','reports'),
    ('synapse_os_lab_addon_annual','registration'), ('synapse_os_lab_addon_annual','opd'),
    ('synapse_os_lab_addon_annual','billing'), ('synapse_os_lab_addon_annual','reports'),
    ('synapse_os_lab_addon_annual','lab'),
    ('synapse_lab_annual','lab'), ('synapse_lab_annual','registration'),
    ('synapse_lab_annual','billing'), ('synapse_lab_annual','reports')
  );
COMMIT;
