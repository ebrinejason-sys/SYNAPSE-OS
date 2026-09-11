-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260612142246  name: add_encounter_status_column
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.


ALTER TABLE encounters
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'completed', 'cancelled'));

CREATE INDEX IF NOT EXISTS encounters_tenant_status_idx
  ON encounters (tenant_id, status, created_at);
