-- Death pronouncement, mortuary custody, pathway care plans.
-- Does not rewrite historical encounter.disposition values; expands the check list.

ALTER TABLE public.clinical_documents
  DROP CONSTRAINT IF EXISTS clinical_documents_document_type_check;

ALTER TABLE public.clinical_documents
  ADD CONSTRAINT clinical_documents_document_type_check
  CHECK (document_type IN (
    'REFERRAL_LETTER','DISCHARGE_SUMMARY','TRANSFER_NOTE','CONSENT_FORM','REFUSAL_FORM',
    'MEDICAL_REPORT','SICK_NOTE','PROCEDURE_NOTE','DEATH_PRONOUNCEMENT','DEATH_SUMMARY',
    'MORTUARY_TRANSFER','BODY_RELEASE','PROPERTY_HANDOVER','LAB_REPORT'
  ));

ALTER TABLE public.encounters
  DROP CONSTRAINT IF EXISTS encounters_disposition_check;

ALTER TABLE public.encounters
  ADD CONSTRAINT encounters_disposition_check
  CHECK (
    disposition IS NULL OR disposition IN (
      'LOCAL_PHARMACY','EXTERNAL_PHARMACY','NO_MEDICATION','FURTHER_LAB','REFERRAL','FOLLOW_UP','CLINICAL_COMPLETE',
      'DISCHARGED','ADMITTED','TRANSFERRED','REFERRED','DECEASED','AMA','LEFT_BEFORE_COMPLETION'
    )
  );

ALTER TABLE public.encounters
  ADD COLUMN IF NOT EXISTS death_pronouncement_id UUID;

CREATE TABLE IF NOT EXISTS public.death_pronouncements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  facility_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  person_id UUID,
  encounter_id UUID NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','pronounced','certified','amended')),
  death_date_time TIMESTAMPTZ,
  death_time_precision TEXT NOT NULL CHECK (death_time_precision IN ('EXACT','ESTIMATED','UNKNOWN')),
  death_time_text TEXT,
  pronounced_at TIMESTAMPTZ NOT NULL,
  pronounced_by UUID NOT NULL,
  location_type TEXT NOT NULL CHECK (location_type IN ('ward','emergency','theatre','icu','arrival','community','other')),
  ward_id UUID,
  bed_id UUID,
  location_text TEXT,
  resuscitation_attempted BOOLEAN NOT NULL DEFAULT false,
  resuscitation_started_at TIMESTAMPTZ,
  resuscitation_stopped_at TIMESTAMPTZ,
  dnr_status TEXT,
  circumstances TEXT,
  provisional_cause TEXT,
  contributing_conditions TEXT,
  external_cause_suspected BOOLEAN NOT NULL DEFAULT false,
  traumatic_death BOOLEAN NOT NULL DEFAULT false,
  suspicious_death BOOLEAN NOT NULL DEFAULT false,
  medicolegal_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
  findings JSONB NOT NULL DEFAULT '{}'::jsonb,
  cause_of_death JSONB NOT NULL DEFAULT '[]'::jsonb,
  next_of_kin JSONB NOT NULL DEFAULT '{"notified":false}'::jsonb,
  certified_at TIMESTAMPTZ,
  certified_by UUID,
  pronouncement_document_id UUID REFERENCES public.clinical_documents(id),
  death_summary_document_id UUID REFERENCES public.clinical_documents(id),
  is_synthetic BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  audit JSONB NOT NULL DEFAULT '[]'::jsonb,
  CONSTRAINT death_pronouncements_exact_time_chk CHECK (
    death_time_precision <> 'EXACT' OR death_date_time IS NOT NULL
  ),
  CONSTRAINT death_pronouncements_unknown_no_clock_chk CHECK (
    death_time_precision <> 'UNKNOWN' OR death_time_text IS NOT NULL
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_death_pronouncements_encounter
  ON public.death_pronouncements (tenant_id, encounter_id);
CREATE INDEX IF NOT EXISTS idx_death_pronouncements_patient
  ON public.death_pronouncements (tenant_id, patient_id, pronounced_at DESC);
CREATE INDEX IF NOT EXISTS idx_death_pronouncements_medicolegal
  ON public.death_pronouncements (tenant_id, pronounced_at DESC)
  WHERE traumatic_death OR suspicious_death OR external_cause_suspected;

ALTER TABLE public.encounters
  DROP CONSTRAINT IF EXISTS encounters_death_pronouncement_id_fkey;
ALTER TABLE public.encounters
  ADD CONSTRAINT encounters_death_pronouncement_id_fkey
  FOREIGN KEY (death_pronouncement_id) REFERENCES public.death_pronouncements(id);

CREATE TABLE IF NOT EXISTS public.mortuary_storage_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  facility_id UUID NOT NULL,
  mortuary_id TEXT NOT NULL,
  room TEXT,
  section TEXT,
  slot_code TEXT NOT NULL,
  occupied_body_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, mortuary_id, slot_code)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mortuary_slots_occupied
  ON public.mortuary_storage_slots (tenant_id, occupied_body_id)
  WHERE occupied_body_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.mortuary_bodies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  facility_id UUID NOT NULL,
  pronouncement_id UUID NOT NULL REFERENCES public.death_pronouncements(id),
  encounter_id UUID,
  status TEXT NOT NULL CHECK (status IN (
    'pronounced','identified','tagged','property_recorded','transport_requested',
    'received','stored','release_authorized','released'
  )),
  identity JSONB NOT NULL,
  storage JSONB,
  property JSONB NOT NULL DEFAULT '[]'::jsonb,
  release JSONB NOT NULL DEFAULT '{"authorized":false}'::jsonb,
  property_document_id UUID REFERENCES public.clinical_documents(id),
  transfer_document_id UUID REFERENCES public.clinical_documents(id),
  release_document_id UUID REFERENCES public.clinical_documents(id),
  storage_slot_id UUID REFERENCES public.mortuary_storage_slots(id),
  is_synthetic BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  audit JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mortuary_bodies_number
  ON public.mortuary_bodies (tenant_id, ((identity->>'bodyNumber')));
CREATE UNIQUE INDEX IF NOT EXISTS idx_mortuary_bodies_active_slot
  ON public.mortuary_bodies (tenant_id, storage_slot_id)
  WHERE storage_slot_id IS NOT NULL AND status NOT IN ('released');
CREATE INDEX IF NOT EXISTS idx_mortuary_bodies_status
  ON public.mortuary_bodies (tenant_id, status, updated_at DESC);

ALTER TABLE public.mortuary_storage_slots
  DROP CONSTRAINT IF EXISTS mortuary_storage_slots_occupied_body_id_fkey;
ALTER TABLE public.mortuary_storage_slots
  ADD CONSTRAINT mortuary_storage_slots_occupied_body_id_fkey
  FOREIGN KEY (occupied_body_id) REFERENCES public.mortuary_bodies(id);

CREATE TABLE IF NOT EXISTS public.patient_care_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL,
  person_id UUID,
  encounter_id UUID NOT NULL,
  pathway_id TEXT NOT NULL,
  pathway_version TEXT NOT NULL,
  source_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active','completed','overridden','abandoned')),
  current_step_id TEXT NOT NULL,
  steps JSONB NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  outcome TEXT,
  is_synthetic BOOLEAN NOT NULL DEFAULT false,
  simulation_run_id TEXT,
  correlation_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_patient_care_plans_encounter
  ON public.patient_care_plans (tenant_id, encounter_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_patient_care_plans_pathway
  ON public.patient_care_plans (tenant_id, pathway_id, pathway_version);

CREATE TABLE IF NOT EXISTS public.pathway_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  care_plan_id UUID NOT NULL REFERENCES public.patient_care_plans(id),
  pathway_id TEXT NOT NULL,
  pathway_version TEXT NOT NULL,
  step_id TEXT NOT NULL,
  recommended_action TEXT NOT NULL,
  actual_action TEXT NOT NULL,
  reason TEXT NOT NULL,
  clinician_id UUID NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  patient_context_reference TEXT NOT NULL,
  may_train_models BOOLEAN NOT NULL DEFAULT false CHECK (may_train_models = false)
);

CREATE INDEX IF NOT EXISTS idx_pathway_overrides_plan
  ON public.pathway_overrides (tenant_id, care_plan_id, timestamp DESC);

ALTER TABLE public.death_pronouncements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mortuary_bodies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mortuary_storage_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_care_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pathway_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant isolation for death pronouncements" ON public.death_pronouncements;
CREATE POLICY "Tenant isolation for death pronouncements" ON public.death_pronouncements
  FOR ALL
  USING (tenant_id = current_tenant_id() OR is_platform_admin())
  WITH CHECK (tenant_id = current_tenant_id() OR is_platform_admin());

DROP POLICY IF EXISTS "Tenant isolation for mortuary bodies" ON public.mortuary_bodies;
CREATE POLICY "Tenant isolation for mortuary bodies" ON public.mortuary_bodies
  FOR ALL
  USING (tenant_id = current_tenant_id() OR is_platform_admin())
  WITH CHECK (tenant_id = current_tenant_id() OR is_platform_admin());

DROP POLICY IF EXISTS "Tenant isolation for mortuary storage" ON public.mortuary_storage_slots;
CREATE POLICY "Tenant isolation for mortuary storage" ON public.mortuary_storage_slots
  FOR ALL
  USING (tenant_id = current_tenant_id() OR is_platform_admin())
  WITH CHECK (tenant_id = current_tenant_id() OR is_platform_admin());

DROP POLICY IF EXISTS "Tenant isolation for patient care plans" ON public.patient_care_plans;
CREATE POLICY "Tenant isolation for patient care plans" ON public.patient_care_plans
  FOR ALL
  USING (tenant_id = current_tenant_id() OR is_platform_admin())
  WITH CHECK (tenant_id = current_tenant_id() OR is_platform_admin());

DROP POLICY IF EXISTS "Tenant isolation for pathway overrides" ON public.pathway_overrides;
CREATE POLICY "Tenant isolation for pathway overrides" ON public.pathway_overrides
  FOR ALL
  USING (tenant_id = current_tenant_id() OR is_platform_admin())
  WITH CHECK (tenant_id = current_tenant_id() OR is_platform_admin());

CREATE OR REPLACE FUNCTION public.death_pronouncements_protect_signed()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status IN ('pronounced', 'certified', 'amended') THEN
      RAISE EXCEPTION 'PRONOUNCEMENT_IMMUTABLE' USING ERRCODE = 'P0001';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD.status IN ('pronounced', 'certified', 'amended') THEN
    IF NEW.status = 'amended' AND OLD.status IN ('pronounced', 'certified')
       AND NEW.death_date_time IS NOT DISTINCT FROM OLD.death_date_time
       AND NEW.death_time_precision IS NOT DISTINCT FROM OLD.death_time_precision
       AND NEW.findings IS NOT DISTINCT FROM OLD.findings THEN
      RETURN NEW;
    END IF;
    IF NEW.status = 'certified' AND OLD.status IN ('pronounced', 'amended')
       AND NEW.death_date_time IS NOT DISTINCT FROM OLD.death_date_time
       AND NEW.death_time_precision IS NOT DISTINCT FROM OLD.death_time_precision THEN
      RETURN NEW;
    END IF;
    IF NEW.next_of_kin IS DISTINCT FROM OLD.next_of_kin
       AND NEW.death_date_time IS NOT DISTINCT FROM OLD.death_date_time
       AND NEW.findings IS NOT DISTINCT FROM OLD.findings
       AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
      RETURN NEW;
    END IF;
    IF NEW.pronouncement_document_id IS DISTINCT FROM OLD.pronouncement_document_id
       OR NEW.death_summary_document_id IS DISTINCT FROM OLD.death_summary_document_id THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'PRONOUNCEMENT_IMMUTABLE' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_death_pronouncements_protect_signed ON public.death_pronouncements;
CREATE TRIGGER trg_death_pronouncements_protect_signed
  BEFORE UPDATE OR DELETE ON public.death_pronouncements
  FOR EACH ROW
  EXECUTE FUNCTION public.death_pronouncements_protect_signed();

INSERT INTO public.capabilities (module, resource, action, description)
VALUES
  ('clinical', 'death', 'pronounce', 'Pronounce death'),
  ('clinical', 'death', 'certify', 'Certify cause of death'),
  ('clinical', 'death', 'summary', 'Write death summary'),
  ('clinical', 'death', 'view', 'View death records'),
  ('registration', 'death', 'view', 'View death certification records'),
  ('mortuary', 'custody', 'write', 'Update body custody and storage'),
  ('mortuary', 'property', 'write', 'Record mortuary property'),
  ('mortuary', 'config', 'write', 'Configure mortuary storage')
ON CONFLICT (module, resource, action) DO NOTHING;

SELECT _grant_hospital_cap('doctor', 'hospital', 'clinical', 'death', 'pronounce');
SELECT _grant_hospital_cap('doctor', 'hospital', 'clinical', 'death', 'summary');
SELECT _grant_hospital_cap('doctor', 'hospital', 'clinical', 'death', 'view');
SELECT _grant_hospital_cap('doctor', 'hospital', 'clinical', 'death', 'certify');
SELECT _grant_hospital_cap('clinical_officer', 'hospital', 'clinical', 'death', 'pronounce');
SELECT _grant_hospital_cap('clinical_officer', 'hospital', 'clinical', 'death', 'view');
SELECT _grant_hospital_cap('nurse', 'hospital', 'clinical', 'death', 'view');
SELECT _grant_hospital_cap('hospital_admin', 'hospital', 'clinical', 'death', 'view');
SELECT _grant_hospital_cap('hospital_admin', 'any', 'mortuary', 'register', 'read');
SELECT _grant_hospital_cap('hospital_admin', 'any', 'mortuary', 'custody', 'write');
SELECT _grant_hospital_cap('hospital_admin', 'any', 'mortuary', 'property', 'write');
SELECT _grant_hospital_cap('hospital_admin', 'any', 'mortuary', 'config', 'write');
SELECT _grant_hospital_cap('mortuary_attendant', 'any', 'mortuary', 'register', 'read');
SELECT _grant_hospital_cap('mortuary_attendant', 'any', 'mortuary', 'register', 'write');
SELECT _grant_hospital_cap('mortuary_attendant', 'any', 'mortuary', 'custody', 'write');
SELECT _grant_hospital_cap('mortuary_attendant', 'any', 'mortuary', 'property', 'write');
SELECT _grant_hospital_cap('mortuary_manager', 'any', 'mortuary', 'register', 'write');
SELECT _grant_hospital_cap('mortuary_manager', 'any', 'mortuary', 'custody', 'write');
SELECT _grant_hospital_cap('mortuary_manager', 'any', 'mortuary', 'property', 'write');
SELECT _grant_hospital_cap('mortuary_manager', 'any', 'mortuary', 'release', 'approve');
SELECT _grant_hospital_cap('mortuary_manager', 'any', 'mortuary', 'config', 'write');
SELECT _grant_hospital_cap('records_officer', 'hospital', 'registration', 'death', 'view');
SELECT _grant_hospital_cap('hospital_admin', 'hospital', 'registration', 'death', 'view');

COMMENT ON TABLE public.death_pronouncements IS
  'Clinical death pronouncement. Certification is a separate capability. Signed pronouncement fields are immutable.';
COMMENT ON TABLE public.mortuary_bodies IS
  'Mortuary custody chain. Release requires authorization. Public tags expose body number only.';
COMMENT ON TABLE public.patient_care_plans IS
  'Patient care plans freeze the pathway version used at activation. AI cannot activate or order.';
