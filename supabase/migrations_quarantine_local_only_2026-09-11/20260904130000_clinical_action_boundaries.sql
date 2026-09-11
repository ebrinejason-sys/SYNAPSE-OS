ALTER TABLE public.lab_results
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

ALTER TABLE public.clinical_prescriptions
  ADD COLUMN IF NOT EXISTS disposition TEXT,
  ADD COLUMN IF NOT EXISTS disposition_reason TEXT,
  ADD COLUMN IF NOT EXISTS disposition_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS disposition_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

ALTER TABLE public.lab_orders
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
  ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

ALTER TABLE public.encounters
  ADD COLUMN IF NOT EXISTS disposition TEXT,
  ADD COLUMN IF NOT EXISTS disposition_reason TEXT,
  ADD COLUMN IF NOT EXISTS disposition_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS disposition_at TIMESTAMPTZ;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'encounters_status_check') THEN
    ALTER TABLE public.encounters DROP CONSTRAINT encounters_status_check;
  END IF;
  ALTER TABLE public.encounters
    ADD CONSTRAINT encounters_status_check CHECK (status IN ('open','signed','completed','cancelled'));
END $$;

ALTER TABLE public.lab_instrument_bridges
  ADD COLUMN IF NOT EXISTS device_id UUID REFERENCES public.lab_devices(id);

ALTER TABLE public.lab_result_staging
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS clinical_result_id UUID REFERENCES public.lab_results(id),
  ADD COLUMN IF NOT EXISTS matched_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS matched_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS previous_accession TEXT,
  ADD COLUMN IF NOT EXISTS reconciliation_notes TEXT;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lab_result_staging_status_check') THEN
    ALTER TABLE public.lab_result_staging DROP CONSTRAINT lab_result_staging_status_check;
  END IF;
  ALTER TABLE public.lab_result_staging
    ADD CONSTRAINT lab_result_staging_status_check CHECK (status IN (
      'RECEIVED','PARSED','MAPPED','MATCHED','UNMAPPED','UNMATCHED','VALIDATION_FAILED',
      'QC_BLOCKED','READY_FOR_REVIEW','ACCEPTED','REJECTED'
    ));
END $$;

INSERT INTO public.capabilities (module, resource, action, description)
VALUES
  ('opd', 'result', 'review', 'Review released clinical results'),
  ('opd', 'encounter', 'disposition', 'Record clinical disposition'),
  ('opd', 'prescription', 'cancel', 'Cancel an undisposed prescription'),
  ('lab', 'order', 'cancel', 'Cancel a cancellable Lab order'),
  ('opd', 'encounter', 'close', 'Close a clinically and financially complete encounter')
ON CONFLICT (module, resource, action) DO NOTHING;

DO $$
DECLARE
  capability_id UUID;
BEGIN
  SELECT id INTO capability_id FROM public.capabilities WHERE module = 'opd' AND resource = 'result' AND action = 'review';
  INSERT INTO public.role_capabilities (role, facility_type, capability_id)
  VALUES ('doctor', 'hospital', capability_id), ('clinical_officer', 'hospital', capability_id)
  ON CONFLICT (role, facility_type, capability_id) DO NOTHING;

  SELECT id INTO capability_id FROM public.capabilities WHERE module = 'opd' AND resource = 'encounter' AND action = 'disposition';
  INSERT INTO public.role_capabilities (role, facility_type, capability_id)
  VALUES ('doctor', 'hospital', capability_id), ('clinical_officer', 'hospital', capability_id)
  ON CONFLICT (role, facility_type, capability_id) DO NOTHING;

  SELECT id INTO capability_id FROM public.capabilities WHERE module = 'opd' AND resource = 'prescription' AND action = 'cancel';
  INSERT INTO public.role_capabilities (role, facility_type, capability_id)
  VALUES ('doctor', 'hospital', capability_id), ('clinical_officer', 'hospital', capability_id)
  ON CONFLICT (role, facility_type, capability_id) DO NOTHING;

  SELECT id INTO capability_id FROM public.capabilities WHERE module = 'lab' AND resource = 'order' AND action = 'cancel';
  INSERT INTO public.role_capabilities (role, facility_type, capability_id)
  VALUES ('doctor', 'hospital', capability_id), ('clinical_officer', 'hospital', capability_id), ('lab_scientist', 'hospital', capability_id)
  ON CONFLICT (role, facility_type, capability_id) DO NOTHING;

  SELECT id INTO capability_id FROM public.capabilities WHERE module = 'opd' AND resource = 'encounter' AND action = 'close';
  INSERT INTO public.role_capabilities (role, facility_type, capability_id)
  VALUES ('doctor', 'hospital', capability_id), ('clinical_officer', 'hospital', capability_id), ('billing_officer', 'hospital', capability_id)
  ON CONFLICT (role, facility_type, capability_id) DO NOTHING;
END $$;