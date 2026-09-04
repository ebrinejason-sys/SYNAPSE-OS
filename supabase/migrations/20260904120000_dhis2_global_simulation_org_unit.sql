-- Simulation fallback is global; production mappings remain tenant-scoped.
ALTER TABLE public.dhis2_org_unit_mappings
  ALTER COLUMN tenant_id DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_dhis2_org_unit_mappings_global_key
  ON public.dhis2_org_unit_mappings (local_org_key)
  WHERE tenant_id IS NULL;

INSERT INTO public.dhis2_org_unit_mappings
  (tenant_id, local_org_key, dhis2_org_unit_id, display_name)
VALUES
  (NULL, 'OU_SIM_FACILITY', 'OU_SIM_FACILITY', 'SYNAPSE simulation facility')
ON CONFLICT (local_org_key) WHERE tenant_id IS NULL DO UPDATE
SET dhis2_org_unit_id = EXCLUDED.dhis2_org_unit_id,
    display_name = EXCLUDED.display_name;

COMMENT ON TABLE public.dhis2_org_unit_mappings IS
  'Local facility to DHIS2 org-unit mappings. OU_SIM_FACILITY is simulation-only; MoH UIDs are required for production.';