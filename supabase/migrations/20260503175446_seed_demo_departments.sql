-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260503175446  name: seed_demo_departments
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.

INSERT INTO demo.departments (id, name, code) VALUES
  ('a1b2c3d4-0001-0001-0001-000000000001', 'Outpatient Department', 'OPD'),
  ('a1b2c3d4-0001-0001-0001-000000000002', 'Emergency', 'EMER'),
  ('a1b2c3d4-0001-0001-0001-000000000003', 'Paediatrics', 'PAED'),
  ('a1b2c3d4-0001-0001-0001-000000000004', 'Cardiology', 'CARD');
