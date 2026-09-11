-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260612231541  name: longitudinal_patient_intelligence
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.


-- Phase 7: Longitudinal patient intelligence tables

CREATE TABLE IF NOT EXISTS patient_clinical_patterns (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id      uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  pattern_type    text NOT NULL,  -- recurrent_symptom | repeated_diagnosis | abnormal_lab_trend |
                                   -- medication_failure | adverse_reaction | vital_trend
  description     text NOT NULL,
  first_seen_at   timestamptz NOT NULL,
  last_seen_at    timestamptz NOT NULL,
  occurrence_count integer NOT NULL DEFAULT 1,
  severity        text NOT NULL DEFAULT 'moderate',  -- mild | moderate | severe
  icd11_code      text,
  evidence        jsonb,    -- array of encounter_ids, lab_ids, etc.
  is_resolved     boolean NOT NULL DEFAULT false,
  resolved_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS patient_clinical_patterns_tenant_idx   ON patient_clinical_patterns(tenant_id);
CREATE INDEX IF NOT EXISTS patient_clinical_patterns_patient_idx  ON patient_clinical_patterns(patient_id);
CREATE INDEX IF NOT EXISTS patient_clinical_patterns_type_idx     ON patient_clinical_patterns(pattern_type);

-- ── Intervention outcomes ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS patient_intervention_outcomes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id      uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  encounter_id    uuid REFERENCES encounters(id),
  intervention    text NOT NULL,   -- drug name / procedure / advice
  intervention_type text NOT NULL DEFAULT 'medication',  -- medication | procedure | referral | advice
  outcome         text NOT NULL DEFAULT 'unknown',  -- improved | stable | worsened | unknown | adverse
  outcome_notes   text,
  started_at      timestamptz NOT NULL,
  evaluated_at    timestamptz,
  recorded_by     uuid NOT NULL REFERENCES profiles(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS patient_intervention_outcomes_tenant_idx   ON patient_intervention_outcomes(tenant_id);
CREATE INDEX IF NOT EXISTS patient_intervention_outcomes_patient_idx  ON patient_intervention_outcomes(patient_id);

-- ── Reasoning context snapshots ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS reasoning_context_snapshots (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      uuid NOT NULL REFERENCES reasoning_sessions(id) ON DELETE CASCADE,
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id      uuid NOT NULL REFERENCES patients(id),
  encounter_id    uuid REFERENCES encounters(id),
  snapshot_at     timestamptz NOT NULL DEFAULT now(),
  chief_complaint text,
  age             integer,
  sex             text,
  vitals          jsonb,    -- { temperature_c, heart_rate, bp_systolic, bp_diastolic, spo2 }
  active_patterns jsonb,    -- array of patient_clinical_patterns summaries
  recent_outcomes jsonb,    -- array of patient_intervention_outcomes summaries
  active_meds     jsonb,    -- array of active prescriptions
  recent_labs     jsonb,    -- array of recent lab results
  insurance_context jsonb,  -- eligibility + coverage summary
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reasoning_context_snapshots_session_idx  ON reasoning_context_snapshots(session_id);
CREATE INDEX IF NOT EXISTS reasoning_context_snapshots_patient_idx  ON reasoning_context_snapshots(patient_id);
CREATE INDEX IF NOT EXISTS reasoning_context_snapshots_tenant_idx   ON reasoning_context_snapshots(tenant_id);

-- ── RLS ────────────────────────────────────────────────────────────────────

ALTER TABLE patient_clinical_patterns      ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_intervention_outcomes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE reasoning_context_snapshots    ENABLE ROW LEVEL SECURITY;

CREATE POLICY patient_patterns_tenant ON patient_clinical_patterns
  USING (same_tenant(tenant_id)) WITH CHECK (same_tenant(tenant_id));

CREATE POLICY patient_outcomes_tenant ON patient_intervention_outcomes
  USING (same_tenant(tenant_id)) WITH CHECK (same_tenant(tenant_id));

CREATE POLICY reasoning_snapshots_tenant ON reasoning_context_snapshots
  USING (same_tenant(tenant_id)) WITH CHECK (same_tenant(tenant_id));
