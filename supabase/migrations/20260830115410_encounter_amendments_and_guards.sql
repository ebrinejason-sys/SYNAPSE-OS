-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260830115410  name: encounter_amendments_and_guards
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.

-- P0-002: Encounter amendment trail + signed-encounter immutability guard
-- P0-005: Production hospital seed reset guard

CREATE TABLE IF NOT EXISTS public.encounter_amendments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  encounter_id    UUID NOT NULL REFERENCES public.encounters(id) ON DELETE CASCADE,
  field_name      TEXT NOT NULL,
  previous_value  TEXT NOT NULL DEFAULT '',
  new_value       TEXT NOT NULL,
  reason          TEXT NOT NULL,
  amended_by      UUID,
  amended_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT encounter_amendments_field_check CHECK (
    field_name IN ('chief_complaint', 'clinical_stage', 'clinical_note')
  )
);

CREATE INDEX IF NOT EXISTS idx_encounter_amendments_encounter
  ON public.encounter_amendments (encounter_id, amended_at DESC);

CREATE INDEX IF NOT EXISTS idx_encounter_amendments_tenant
  ON public.encounter_amendments (tenant_id);

ALTER TABLE public.encounter_amendments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'encounter_amendments_tenant_isolation'
  ) THEN
    CREATE POLICY encounter_amendments_tenant_isolation ON public.encounter_amendments
      FOR ALL USING (tenant_id = public.current_tenant_id());
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.guard_signed_encounter_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.is_signed IS TRUE THEN
    IF (
      NEW.chief_complaint IS DISTINCT FROM OLD.chief_complaint
      OR NEW.clinical_stage IS DISTINCT FROM OLD.clinical_stage
      OR NEW.metadata IS DISTINCT FROM OLD.metadata
    ) AND COALESCE(current_setting('synapse.encounter_amendment', true), '') <> '1' THEN
      RAISE EXCEPTION 'ENCOUNTER_SIGNED_IMMUTABLE'
        USING HINT = 'Use apply_encounter_amendment() to change signed clinical content.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_signed_encounter_update ON public.encounters;
CREATE TRIGGER trg_guard_signed_encounter_update
  BEFORE UPDATE ON public.encounters
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_signed_encounter_update();

CREATE OR REPLACE FUNCTION public.apply_encounter_amendment(
  p_tenant_id uuid,
  p_encounter_id uuid,
  p_field text,
  p_new_value text,
  p_reason text,
  p_amended_by uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_encounter public.encounters%ROWTYPE;
  v_previous text;
  v_amendment_id uuid := gen_random_uuid();
BEGIN
  SELECT * INTO v_encounter
  FROM public.encounters
  WHERE id = p_encounter_id AND tenant_id = p_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ENCOUNTER_NOT_FOUND';
  END IF;
  IF v_encounter.is_signed IS NOT TRUE THEN
    RAISE EXCEPTION 'ENCOUNTER_NOT_SIGNED';
  END IF;
  IF length(trim(COALESCE(p_reason, ''))) < 3 THEN
    RAISE EXCEPTION 'AMENDMENT_REASON_REQUIRED';
  END IF;

  IF p_field = 'chief_complaint' THEN
    v_previous := COALESCE(v_encounter.chief_complaint, '');
  ELSIF p_field = 'clinical_stage' THEN
    v_previous := COALESCE(v_encounter.clinical_stage, '');
  ELSIF p_field = 'clinical_note' THEN
    v_previous := COALESCE(v_encounter.metadata->>'clinical_note', '');
  ELSE
    RAISE EXCEPTION 'INVALID_AMENDMENT_FIELD';
  END IF;

  IF v_previous IS NOT DISTINCT FROM p_new_value THEN
    RAISE EXCEPTION 'AMENDMENT_NO_CHANGE';
  END IF;

  INSERT INTO public.encounter_amendments (
    id, tenant_id, encounter_id, field_name,
    previous_value, new_value, reason, amended_by
  ) VALUES (
    v_amendment_id, p_tenant_id, p_encounter_id, p_field,
    v_previous, p_new_value, trim(p_reason), p_amended_by
  );

  PERFORM set_config('synapse.encounter_amendment', '1', true);

  IF p_field = 'chief_complaint' THEN
    UPDATE public.encounters
    SET chief_complaint = p_new_value,
        updated_at = now(),
        version = COALESCE(version, 0) + 1
    WHERE id = p_encounter_id;
  ELSIF p_field = 'clinical_stage' THEN
    UPDATE public.encounters
    SET clinical_stage = p_new_value,
        updated_at = now(),
        version = COALESCE(version, 0) + 1
    WHERE id = p_encounter_id;
  ELSIF p_field = 'clinical_note' THEN
    UPDATE public.encounters
    SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('clinical_note', p_new_value),
        updated_at = now(),
        version = COALESCE(version, 0) + 1
    WHERE id = p_encounter_id;
  END IF;

  RETURN v_amendment_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_hospital_seed_reset()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  tenant_env text;
BEGIN
  IF NEW.last_reset_at IS DISTINCT FROM OLD.last_reset_at
     AND COALESCE(OLD.is_synthetic, true) = false THEN
    SELECT environment INTO tenant_env
    FROM public.tenants
    WHERE id = NEW.tenant_id;

    IF tenant_env IS NULL OR tenant_env NOT IN ('demo', 'synthetic', 'test') THEN
      RAISE EXCEPTION 'PRODUCTION_HOSPITAL_SEED_RESET_BLOCKED';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_hospital_seed_reset ON public.hospital_seed_registry;
CREATE TRIGGER trg_guard_hospital_seed_reset
  BEFORE UPDATE ON public.hospital_seed_registry
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_hospital_seed_reset();

INSERT INTO capabilities (module, resource, action, description)
SELECT v.module, v.resource, v.action, v.description
FROM (VALUES
  ('opd', 'encounter', 'amend', 'Amend signed encounter note via trail'),
  ('billing', 'invoice', 'read',   'View encounter billing invoice')
) AS v(module, resource, action, description)
WHERE NOT EXISTS (
  SELECT 1 FROM capabilities c
  WHERE c.module = v.module AND c.resource = v.resource AND c.action = v.action
);

INSERT INTO role_capabilities (role, facility_type, capability_id)
SELECT g.role, g.facility_type, c.id
FROM (VALUES
  ('doctor',           'hospital', 'opd',     'encounter', 'amend'),
  ('clinical_officer', 'hospital', 'opd',     'encounter', 'amend'),
  ('doctor',           'hospital', 'billing', 'invoice',   'read'),
  ('billing_officer',  'hospital', 'billing', 'invoice',   'read'),
  ('cashier',          'hospital', 'billing', 'invoice',   'read')
) AS g(role, facility_type, module, resource, action)
JOIN capabilities c
  ON c.module = g.module AND c.resource = g.resource AND c.action = g.action
ON CONFLICT (role, facility_type, capability_id) DO NOTHING;
