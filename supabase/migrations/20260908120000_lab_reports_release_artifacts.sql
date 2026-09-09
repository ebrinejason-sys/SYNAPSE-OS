-- Durable, immutable Lab report versions. Clinical release and delivery are separate concerns.
CREATE TABLE IF NOT EXISTS public.lab_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  facility_id UUID,
  patient_id UUID NOT NULL,
  encounter_id UUID,
  lab_order_id UUID NOT NULL,
  clinical_result_id UUID NOT NULL REFERENCES public.lab_results(id),
  accession TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('FINAL', 'AMENDED')),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  report_type TEXT NOT NULL DEFAULT 'LAB_RESULT',
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  generated_by UUID,
  verified_by UUID,
  released_at TIMESTAMPTZ NOT NULL,
  supersedes_report_id UUID REFERENCES public.lab_reports(id),
  amendment_reason TEXT,
  template_version TEXT NOT NULL DEFAULT 'lab-report.v1',
  html_snapshot TEXT NOT NULL,
  artifact_path TEXT,
  content_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, lab_order_id, version)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_lab_reports_final_order
  ON public.lab_reports (tenant_id, lab_order_id)
  WHERE status = 'FINAL' AND version = 1;
CREATE INDEX IF NOT EXISTS idx_lab_reports_patient
  ON public.lab_reports (tenant_id, patient_id, released_at DESC);

ALTER TABLE public.lab_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for lab reports" ON public.lab_reports
  FOR ALL
  USING (tenant_id = current_tenant_id() OR is_platform_admin())
  WITH CHECK (tenant_id = current_tenant_id() OR is_platform_admin());

COMMENT ON TABLE public.lab_reports IS
  'Immutable printable Lab report versions. Release is not delivery; artifacts require tenant-authorized access.';