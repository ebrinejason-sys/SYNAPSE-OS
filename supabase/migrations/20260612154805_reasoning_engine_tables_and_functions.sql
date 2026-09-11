-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260612154805  name: reasoning_engine_tables_and_functions
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.


-- ============================================================
-- PHASE C1: Probabilistic reasoning engine tables
-- ============================================================

CREATE TABLE IF NOT EXISTS reasoning_sessions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id uuid NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
  tenant_id    uuid NOT NULL,
  created_by   uuid NOT NULL,
  status       text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'abandoned')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rs_encounter_idx ON reasoning_sessions (encounter_id);
CREATE INDEX IF NOT EXISTS rs_tenant_idx    ON reasoning_sessions (tenant_id);

CREATE TABLE IF NOT EXISTS reasoning_hypotheses (
  id                    uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id            uuid         NOT NULL REFERENCES reasoning_sessions(id) ON DELETE CASCADE,
  tenant_id             uuid         NOT NULL,
  condition_name        text         NOT NULL,
  icd11_code            text,
  icd11_uri             text,
  prior_probability     numeric(6,4) NOT NULL DEFAULT 0.001
    CHECK (prior_probability > 0 AND prior_probability < 1),
  posterior_probability numeric(6,4)
    CHECK (posterior_probability IS NULL OR (posterior_probability > 0 AND posterior_probability < 1)),
  harm_if_missed        numeric(5,4) NOT NULL DEFAULT 0.5
    CHECK (harm_if_missed >= 0 AND harm_if_missed <= 1),
  expected_harm         numeric(5,4),
  cant_miss             boolean      NOT NULL DEFAULT false,
  status                text         NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'confirmed', 'overridden', 'rejected')),
  ai_reasoning          text,
  confidence            numeric(5,4)
    CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  rank                  integer,
  created_at            timestamptz  NOT NULL DEFAULT now(),
  updated_at            timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rh_session_idx ON reasoning_hypotheses (session_id);

CREATE TABLE IF NOT EXISTS reasoning_evidence (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  uuid        NOT NULL REFERENCES reasoning_sessions(id) ON DELETE CASCADE,
  tenant_id   uuid        NOT NULL,
  source      text        NOT NULL
    CHECK (source IN ('symptom','sign','lab','imaging','history','vital')),
  description text        NOT NULL,
  value       text,
  present     boolean     NOT NULL DEFAULT true,
  added_by    uuid        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS re_session_idx ON reasoning_evidence (session_id);

CREATE TABLE IF NOT EXISTS reasoning_evidence_impact (
  id               uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       uuid         NOT NULL REFERENCES reasoning_sessions(id) ON DELETE CASCADE,
  hypothesis_id    uuid         NOT NULL REFERENCES reasoning_hypotheses(id) ON DELETE CASCADE,
  evidence_id      uuid         NOT NULL REFERENCES reasoning_evidence(id) ON DELETE CASCADE,
  likelihood_ratio numeric(10,4) NOT NULL CHECK (likelihood_ratio > 0),
  computed_at      timestamptz  NOT NULL DEFAULT now(),
  UNIQUE (hypothesis_id, evidence_id)
);

CREATE TABLE IF NOT EXISTS reasoning_actions (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    uuid        NOT NULL REFERENCES reasoning_sessions(id) ON DELETE CASCADE,
  hypothesis_id uuid        NOT NULL REFERENCES reasoning_hypotheses(id),
  tenant_id     uuid        NOT NULL,
  action        text        NOT NULL CHECK (action IN ('confirm','override','reject')),
  clinician_id  uuid        NOT NULL,
  reason        text,
  diagnosis_id  uuid,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Immutable audit log — no updates, no deletes
CREATE TABLE IF NOT EXISTS reasoning_audit (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid        NOT NULL REFERENCES reasoning_sessions(id) ON DELETE CASCADE,
  tenant_id  uuid        NOT NULL,
  event_type text        NOT NULL,
  actor_id   uuid,
  payload    jsonb       NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ra_session_idx ON reasoning_audit (session_id, created_at);

-- RLS
ALTER TABLE reasoning_sessions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE reasoning_hypotheses     ENABLE ROW LEVEL SECURITY;
ALTER TABLE reasoning_evidence       ENABLE ROW LEVEL SECURITY;
ALTER TABLE reasoning_evidence_impact ENABLE ROW LEVEL SECURITY;
ALTER TABLE reasoning_actions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE reasoning_audit          ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rsess_rw_authenticated" ON reasoning_sessions        FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "rhyp_rw_authenticated"  ON reasoning_hypotheses      FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "revi_rw_authenticated"  ON reasoning_evidence        FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "reimp_rw_authenticated" ON reasoning_evidence_impact FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "ract_rw_authenticated"  ON reasoning_actions         FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "raud_read_authenticated" ON reasoning_audit          FOR SELECT USING (auth.role() = 'authenticated');

-- ============================================================
-- PHASE C2: Bayesian differential recompute function
-- ============================================================

CREATE OR REPLACE FUNCTION recompute_differential(p_session_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  hyp             RECORD;
  log_prior_odds  numeric;
  log_post_odds   numeric;
  lr_sum          numeric;
  post_prob       numeric;
  exp_harm        numeric;
  sess_tenant_id  uuid;
BEGIN
  SELECT tenant_id INTO sess_tenant_id FROM reasoning_sessions WHERE id = p_session_id;

  FOR hyp IN
    SELECT id, prior_probability, harm_if_missed, cant_miss
    FROM reasoning_hypotheses
    WHERE session_id = p_session_id AND status = 'active'
  LOOP
    -- log(prior_odds) = log(p / (1-p)); clamp to avoid log(0)
    log_prior_odds := LN(
      GREATEST(0.0001, hyp.prior_probability) /
      GREATEST(0.0001, 1.0 - hyp.prior_probability)
    );

    -- Sum of log(LR) for all evidence affecting this hypothesis
    SELECT COALESCE(SUM(LN(GREATEST(0.0001, ei.likelihood_ratio))), 0.0)
    INTO lr_sum
    FROM reasoning_evidence_impact ei
    WHERE ei.hypothesis_id = hyp.id
      AND ei.session_id    = p_session_id;

    log_post_odds := log_prior_odds + lr_sum;

    -- Sigmoid: P = 1 / (1 + e^(-log_odds))
    post_prob := 1.0 / (1.0 + EXP(-log_post_odds));
    post_prob := GREATEST(0.0001, LEAST(0.9999, post_prob));

    exp_harm := post_prob * hyp.harm_if_missed;

    UPDATE reasoning_hypotheses
    SET posterior_probability = post_prob,
        expected_harm         = exp_harm,
        updated_at            = now()
    WHERE id = hyp.id;
  END LOOP;

  -- Rank: cant_miss first, then by expected_harm DESC
  WITH ranked AS (
    SELECT id,
      ROW_NUMBER() OVER (
        ORDER BY cant_miss DESC, expected_harm DESC NULLS LAST
      ) AS rn
    FROM reasoning_hypotheses
    WHERE session_id = p_session_id AND status = 'active'
  )
  UPDATE reasoning_hypotheses h
  SET rank = ranked.rn
  FROM ranked
  WHERE h.id = ranked.id;

  -- Audit
  INSERT INTO reasoning_audit (session_id, tenant_id, event_type, actor_id, payload)
  VALUES (p_session_id, sess_tenant_id, 'differential_recomputed', NULL,
    jsonb_build_object('recomputed_at', now()::text));
END;
$$;
