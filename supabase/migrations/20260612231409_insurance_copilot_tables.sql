-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260612231409  name: insurance_copilot_tables
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.


-- Phase 6: Insurance copilot tables — additive only
-- NOTE: insurance_claims, claim_line_items, payer_contracts already exist — DO NOT recreate

CREATE TABLE IF NOT EXISTS insurance_policies (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id      uuid REFERENCES patients(id),
  payer_id        uuid,  -- references payer_contracts.id when linked
  policy_number   text NOT NULL,
  member_id       text,
  group_number    text,
  holder_name     text,
  holder_dob      date,
  effective_date  date,
  expiry_date     date,
  plan_name       text,
  coverage_type   text NOT NULL DEFAULT 'inpatient',  -- inpatient | outpatient | both
  copay_amount    numeric(10,2),
  deductible      numeric(10,2),
  max_benefit     numeric(10,2),
  status          text NOT NULL DEFAULT 'active',   -- active | expired | suspended
  verified_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS insurance_policies_tenant_idx   ON insurance_policies(tenant_id);
CREATE INDEX IF NOT EXISTS insurance_policies_patient_idx  ON insurance_policies(patient_id);
CREATE INDEX IF NOT EXISTS insurance_policies_policy_num_idx ON insurance_policies(policy_number);

-- ── Benefits ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS insurance_benefits (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id   uuid NOT NULL REFERENCES insurance_policies(id) ON DELETE CASCADE,
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  benefit_key text NOT NULL,    -- e.g. 'inpatient', 'outpatient', 'dental', 'maternity'
  limit_amount  numeric(10,2),
  used_amount   numeric(10,2) NOT NULL DEFAULT 0,
  period        text NOT NULL DEFAULT 'annual',  -- annual | lifetime | per_visit
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (policy_id, benefit_key)
);

CREATE INDEX IF NOT EXISTS insurance_benefits_policy_idx ON insurance_benefits(policy_id);
CREATE INDEX IF NOT EXISTS insurance_benefits_tenant_idx ON insurance_benefits(tenant_id);

-- ── Pre-authorisations ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS insurance_preauthorizations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  policy_id       uuid REFERENCES insurance_policies(id),
  patient_id      uuid REFERENCES patients(id),
  encounter_id    uuid REFERENCES encounters(id),
  requested_by    uuid NOT NULL REFERENCES profiles(id),
  payer_id        uuid,
  auth_type       text NOT NULL DEFAULT 'inpatient', -- inpatient | procedure | medication | referral
  diagnosis_codes text[],
  procedure_codes text[],
  estimated_cost  numeric(10,2),
  clinical_notes  text,
  status          text NOT NULL DEFAULT 'draft',  -- draft | submitted | approved | denied | expired
  auth_number     text,    -- issued by payer on approval
  approved_amount numeric(10,2),
  payer_notes     text,
  submitted_at    timestamptz,  -- set only when human explicitly submits
  expires_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT preauth_no_auto_submit CHECK (
    status != 'submitted' OR submitted_at IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS insurance_preauths_tenant_idx   ON insurance_preauthorizations(tenant_id);
CREATE INDEX IF NOT EXISTS insurance_preauths_patient_idx  ON insurance_preauthorizations(patient_id);
CREATE INDEX IF NOT EXISTS insurance_preauths_encounter_idx ON insurance_preauthorizations(encounter_id);
CREATE INDEX IF NOT EXISTS insurance_preauths_status_idx   ON insurance_preauthorizations(status);

-- ── Coverage checks ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS insurance_coverage_checks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  policy_id       uuid REFERENCES insurance_policies(id),
  patient_id      uuid REFERENCES patients(id),
  encounter_id    uuid REFERENCES encounters(id),
  checked_by      uuid NOT NULL REFERENCES profiles(id),
  check_type      text NOT NULL DEFAULT 'eligibility',  -- eligibility | benefit | copay
  service_code    text,
  covered         boolean,
  copay_amount    numeric(10,2),
  benefit_limit   numeric(10,2),
  benefit_used    numeric(10,2),
  notes           text,
  raw_response    jsonb,  -- copilot AI response (advisory only)
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS insurance_coverage_checks_tenant_idx   ON insurance_coverage_checks(tenant_id);
CREATE INDEX IF NOT EXISTS insurance_coverage_checks_patient_idx  ON insurance_coverage_checks(patient_id);
CREATE INDEX IF NOT EXISTS insurance_coverage_checks_encounter_idx ON insurance_coverage_checks(encounter_id);

-- ── Copilot audit ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS insurance_copilot_audit (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  actor_id    uuid REFERENCES profiles(id),
  action      text NOT NULL,  -- eligibility_check | coverage_check | claim_drafted |
                               -- preauth_drafted | rejection_risk_scored | denial_explained |
                               -- appeal_drafted | payment_reconciled
  patient_id  uuid REFERENCES patients(id),
  resource_id uuid,
  input       jsonb,
  output      jsonb,
  ai_model    text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS insurance_copilot_audit_tenant_idx ON insurance_copilot_audit(tenant_id);
CREATE INDEX IF NOT EXISTS insurance_copilot_audit_actor_idx  ON insurance_copilot_audit(actor_id);

-- ── RLS ────────────────────────────────────────────────────────────────────

ALTER TABLE insurance_policies          ENABLE ROW LEVEL SECURITY;
ALTER TABLE insurance_benefits          ENABLE ROW LEVEL SECURITY;
ALTER TABLE insurance_preauthorizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE insurance_coverage_checks   ENABLE ROW LEVEL SECURITY;
ALTER TABLE insurance_copilot_audit     ENABLE ROW LEVEL SECURITY;

CREATE POLICY insurance_policies_tenant ON insurance_policies
  USING (same_tenant(tenant_id)) WITH CHECK (same_tenant(tenant_id));

CREATE POLICY insurance_benefits_tenant ON insurance_benefits
  USING (same_tenant(tenant_id)) WITH CHECK (same_tenant(tenant_id));

CREATE POLICY insurance_preauths_tenant ON insurance_preauthorizations
  USING (same_tenant(tenant_id)) WITH CHECK (same_tenant(tenant_id));

CREATE POLICY insurance_coverage_checks_tenant ON insurance_coverage_checks
  USING (same_tenant(tenant_id)) WITH CHECK (same_tenant(tenant_id));

CREATE POLICY insurance_copilot_audit_tenant ON insurance_copilot_audit
  USING (same_tenant(tenant_id)) WITH CHECK (same_tenant(tenant_id));
