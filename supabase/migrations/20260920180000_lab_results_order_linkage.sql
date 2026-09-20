-- Canonical Lab domain already keys clinical results by lab_order_id
-- (LabResult.labOrderId, lab_specimens, lab_reports, lab_result_amendments,
-- lab_result_staging). public.lab_results was still encounter-only, so
-- Lab Tech persist wrote unknown columns and Lab Scientist verify loaded
-- nothing. Add the missing order linkage — do not invent a parallel model.

ALTER TABLE public.lab_results
  ADD COLUMN IF NOT EXISTS lab_order_id UUID,
  ADD COLUMN IF NOT EXISTS patient_id UUID,
  ADD COLUMN IF NOT EXISTS result_value TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT,
  ADD COLUMN IF NOT EXISTS is_critical BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_abnormal BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS released_to_patient_at TIMESTAMPTZ;

UPDATE public.lab_results
SET result_value = value
WHERE result_value IS NULL;

-- Deterministic backfill: latest matching order on the same tenant+encounter+test.
UPDATE public.lab_results r
SET
  lab_order_id = m.lab_order_id,
  patient_id = COALESCE(r.patient_id, m.patient_id),
  tenant_id = COALESCE(r.tenant_id, m.tenant_id)
FROM (
  SELECT DISTINCT ON (r2.id)
    r2.id AS result_id,
    o.id AS lab_order_id,
    o.patient_id,
    o.tenant_id
  FROM public.lab_results r2
  INNER JOIN public.lab_orders o
    ON o.encounter_id = r2.encounter_id
   AND (r2.tenant_id IS NULL OR o.tenant_id = r2.tenant_id)
   AND (
     (NULLIF(r2.loinc_code, '') IS NOT NULL AND o.loinc_code = r2.loinc_code)
     OR o.test_name = r2.test_name
   )
  ORDER BY r2.id, o.ordered_at DESC
) m
WHERE r.id = m.result_id
  AND r.lab_order_id IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.lab_results WHERE lab_order_id IS NULL) THEN
    RAISE EXCEPTION 'lab_results.lab_order_id backfill left orphans; refuse nullable linkage';
  END IF;
  IF EXISTS (SELECT 1 FROM public.lab_results WHERE tenant_id IS NULL) THEN
    RAISE EXCEPTION 'lab_results.tenant_id still null after order backfill';
  END IF;
  IF EXISTS (SELECT 1 FROM public.lab_results WHERE patient_id IS NULL) THEN
    RAISE EXCEPTION 'lab_results.patient_id still null after order backfill';
  END IF;
END $$;

ALTER TABLE public.lab_results
  ALTER COLUMN lab_order_id SET NOT NULL,
  ALTER COLUMN tenant_id SET NOT NULL,
  ALTER COLUMN patient_id SET NOT NULL;

UPDATE public.lab_results
SET status = COALESCE(status, CASE WHEN verified_at IS NULL THEN 'preliminary' ELSE 'final' END)
WHERE status IS NULL;

ALTER TABLE public.lab_results
  ALTER COLUMN status SET DEFAULT 'preliminary';

ALTER TABLE public.lab_results
  ALTER COLUMN status SET NOT NULL;

DO $$
BEGIN
  ALTER TABLE public.lab_results
    ADD CONSTRAINT lab_results_status_check
    CHECK (status = ANY (ARRAY['preliminary'::text, 'final'::text, 'corrected'::text, 'cancelled'::text]));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.lab_orders
    ADD CONSTRAINT lab_orders_id_tenant_uid UNIQUE (id, tenant_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.lab_results
    ADD CONSTRAINT lab_results_tenant_order_uid UNIQUE (tenant_id, lab_order_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.lab_results
    ADD CONSTRAINT lab_results_lab_order_tenant_fkey
    FOREIGN KEY (lab_order_id, tenant_id)
    REFERENCES public.lab_orders (id, tenant_id)
    ON DELETE RESTRICT;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.lab_results
    ADD CONSTRAINT lab_results_patient_id_fkey
    FOREIGN KEY (patient_id) REFERENCES public.patients (id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_lab_results_order
  ON public.lab_results (tenant_id, lab_order_id);

COMMENT ON COLUMN public.lab_results.lab_order_id IS
  'Canonical parent Lab order. Specimens/reports/amendments already use this key; results must match.';
