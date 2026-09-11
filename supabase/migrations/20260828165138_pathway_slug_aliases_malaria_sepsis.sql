-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260828165138  name: pathway_slug_aliases_malaria_sepsis
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.

-- Journey aliases expected by POST /api/clinical/pathways/start.
INSERT INTO public.clinical_pathway_templates (
  hospital_id, name, slug, category, icd11_codes, description, is_active, is_system, version,
  steps, triggers, checklist, auto_orders, alert_rules, tenant_id
)
SELECT hospital_id, name, 'malaria', category, icd11_codes, description, is_active, is_system, version,
       steps, triggers, checklist, auto_orders, alert_rules, tenant_id
FROM public.clinical_pathway_templates
WHERE slug = 'malaria-ug' AND hospital_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM public.clinical_pathway_templates WHERE slug = 'malaria' AND hospital_id IS NULL)
LIMIT 1;

INSERT INTO public.clinical_pathway_templates (
  hospital_id, name, slug, category, icd11_codes, description, is_active, is_system, version,
  steps, triggers, checklist, auto_orders, alert_rules, tenant_id
)
SELECT hospital_id, name, 'malaria-testing', category, icd11_codes, description, is_active, is_system, version,
       steps, triggers, checklist, auto_orders, alert_rules, tenant_id
FROM public.clinical_pathway_templates
WHERE slug = 'malaria-ug' AND hospital_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM public.clinical_pathway_templates WHERE slug = 'malaria-testing' AND hospital_id IS NULL)
LIMIT 1;

INSERT INTO public.clinical_pathway_templates (
  hospital_id, name, slug, category, icd11_codes, description, is_active, is_system, version,
  steps, triggers, checklist, auto_orders, alert_rules, tenant_id
)
SELECT hospital_id, name, 'sepsis', category, icd11_codes, description, is_active, is_system, version,
       steps, triggers, checklist, auto_orders, alert_rules, tenant_id
FROM public.clinical_pathway_templates
WHERE slug = 'sepsis-bundle-h1' AND hospital_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM public.clinical_pathway_templates WHERE slug = 'sepsis' AND hospital_id IS NULL)
LIMIT 1;

INSERT INTO public.clinical_pathway_templates (
  hospital_id, name, slug, category, icd11_codes, description, is_active, is_system, version,
  steps, triggers, checklist, auto_orders, alert_rules, tenant_id
)
SELECT hospital_id, name, 'sepsis-adult', category, icd11_codes, description, is_active, is_system, version,
       steps, triggers, checklist, auto_orders, alert_rules, tenant_id
FROM public.clinical_pathway_templates
WHERE slug = 'sepsis-bundle-h1' AND hospital_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM public.clinical_pathway_templates WHERE slug = 'sepsis-adult' AND hospital_id IS NULL)
LIMIT 1;
