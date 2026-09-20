-- Clinical documents engine, closed-loop referral overlay, and Consent Centre columns.
-- Does not rewrite historical facility_referrals.status values.

CREATE TABLE IF NOT EXISTS public.clinical_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  facility_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  person_id UUID,
  encounter_id UUID,
  author_id UUID NOT NULL,
  document_type TEXT NOT NULL CHECK (document_type IN (
    'REFERRAL_LETTER','DISCHARGE_SUMMARY','TRANSFER_NOTE','CONSENT_FORM','REFUSAL_FORM',
    'MEDICAL_REPORT','SICK_NOTE','PROCEDURE_NOTE','DEATH_PRONOUNCEMENT','DEATH_SUMMARY','LAB_REPORT'
  )),
  template_id TEXT NOT NULL,
  template_version TEXT NOT NULL,
  country_pack TEXT,
  structured_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  rendered_snapshot TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','final','signed','amended','superseded')),
  signed_by UUID,
  signed_at TIMESTAMPTZ,
  witness_id UUID,
  witness_name TEXT,
  supersedes_id UUID REFERENCES public.clinical_documents(id),
  amendment_of_id UUID REFERENCES public.clinical_documents(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  audit JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_clinical_documents_tenant_patient
  ON public.clinical_documents (tenant_id, patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clinical_documents_encounter
  ON public.clinical_documents (tenant_id, encounter_id, created_at DESC)
  WHERE encounter_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clinical_documents_type
  ON public.clinical_documents (tenant_id, document_type, status);

ALTER TABLE public.clinical_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant isolation for clinical documents" ON public.clinical_documents;
CREATE POLICY "Tenant isolation for clinical documents" ON public.clinical_documents
  FOR ALL
  USING (tenant_id = current_tenant_id() OR is_platform_admin())
  WITH CHECK (tenant_id = current_tenant_id() OR is_platform_admin());

CREATE OR REPLACE FUNCTION public.clinical_documents_protect_signed()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status IN ('signed', 'superseded') THEN
      RAISE EXCEPTION 'DOCUMENT_IMMUTABLE' USING ERRCODE = 'P0001';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.status IN ('signed', 'superseded') THEN
    IF NEW.status = 'superseded' AND OLD.status = 'signed'
       AND NEW.content_hash IS NOT DISTINCT FROM OLD.content_hash
       AND NEW.rendered_snapshot IS NOT DISTINCT FROM OLD.rendered_snapshot
       AND NEW.structured_payload IS NOT DISTINCT FROM OLD.structured_payload THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'DOCUMENT_IMMUTABLE' USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clinical_documents_protect_signed ON public.clinical_documents;
CREATE TRIGGER trg_clinical_documents_protect_signed
  BEFORE UPDATE OR DELETE ON public.clinical_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.clinical_documents_protect_signed();

COMMENT ON TABLE public.clinical_documents IS
  'Reusable clinical documents. Signed rows are immutable; corrections create amendment versions.';

ALTER TABLE public.facility_referrals
  ADD COLUMN IF NOT EXISTS loop_stage TEXT,
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS arrived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS seen_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS feedback TEXT,
  ADD COLUMN IF NOT EXISTS counter_referral_id UUID REFERENCES public.facility_referrals(id),
  ADD COLUMN IF NOT EXISTS letter_document_id UUID REFERENCES public.clinical_documents(id);

ALTER TABLE public.facility_referrals DROP CONSTRAINT IF EXISTS facility_referrals_loop_stage_check;
ALTER TABLE public.facility_referrals
  ADD CONSTRAINT facility_referrals_loop_stage_check
  CHECK (
    loop_stage IS NULL OR loop_stage IN (
      'created','sent','received','accepted','arrived','seen',
      'feedback_returned','completed','rejected','cancelled'
    )
  );

ALTER TABLE public.person_consents DROP CONSTRAINT IF EXISTS person_consents_purpose_check;
ALTER TABLE public.person_consents
  ADD CONSTRAINT person_consents_purpose_check CHECK (purpose IN (
    'facility_access','cross_facility_share','research','emergency_profile',
    'blood_donor_contact','dependant_access','insurance_exchange','care_delivery',
    'general_treatment','procedure','surgery','anesthesia','blood_transfusion',
    'hiv_testing','telemedicine','data_sharing','photography_media','records_release',
    'refusal_of_treatment','discharge_ama'
  ));

ALTER TABLE public.person_consents
  ADD COLUMN IF NOT EXISTS signer_relationship TEXT,
  ADD COLUMN IF NOT EXISTS witness_name TEXT,
  ADD COLUMN IF NOT EXISTS staff_witness_id UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS template_version TEXT,
  ADD COLUMN IF NOT EXISTS content_hash TEXT,
  ADD COLUMN IF NOT EXISTS encounter_id UUID,
  ADD COLUMN IF NOT EXISTS capture_method TEXT,
  ADD COLUMN IF NOT EXISTS document_id UUID REFERENCES public.clinical_documents(id),
  ADD COLUMN IF NOT EXISTS country_pack TEXT,
  ADD COLUMN IF NOT EXISTS patient_id UUID;

ALTER TABLE public.person_consents DROP CONSTRAINT IF EXISTS person_consents_signer_relationship_check;
ALTER TABLE public.person_consents
  ADD CONSTRAINT person_consents_signer_relationship_check
  CHECK (signer_relationship IS NULL OR signer_relationship IN ('self','guardian','proxy'));

ALTER TABLE public.person_consents DROP CONSTRAINT IF EXISTS person_consents_capture_method_check;
ALTER TABLE public.person_consents
  ADD CONSTRAINT person_consents_capture_method_check
  CHECK (capture_method IS NULL OR capture_method IN ('electronic_ack','otp','paper_scan'));
