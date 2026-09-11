-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260828165136  name: pathway_dka_pneumonia_seeds
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.

-- Additive pathway seeds for DKA and pneumonia (global system templates).
-- Does not modify existing malaria/sepsis/PPH templates.
INSERT INTO public.clinical_pathway_templates
  (id, hospital_id, name, slug, category, icd11_codes, description, is_active, is_system, version, steps, triggers, checklist, auto_orders, alert_rules)
VALUES
  (gen_random_uuid(), null, 'Diabetic Ketoacidosis (DKA)', 'dka-emergency', 'emergency',
   array['5A21'], 'Emergency DKA pathway: serial glucose/electrolytes, fluids, insulin, potassium monitoring',
   true, true, 1,
   '[{"order":1,"title":"Confirm DKA criteria (glucose, ketones, acidosis)","type":"assessment"},{"order":2,"title":"IV access + fluid resuscitation","type":"task"},{"order":3,"title":"Baseline labs: glucose, electrolytes, VBG/ABG, ketones","type":"order"},{"order":4,"title":"Start insulin infusion per protocol","type":"order"},{"order":5,"title":"Potassium replacement if indicated","type":"order"},{"order":6,"title":"Hourly glucose + 2-4h electrolytes","type":"task"},{"order":7,"title":"Transition criteria checklist","type":"assessment"}]'::jsonb,
   '[{"field":"glucose_mmol","operator":">","value":13.9},{"field":"ketones_positive","operator":"=","value":true}]'::jsonb,
   '[{"title":"DKA confirmed","item_type":"assessment"},{"title":"Fluids started","item_type":"task"},{"title":"Insulin protocol started","item_type":"order"},{"title":"K+ monitored","item_type":"order"},{"title":"Serial labs scheduled","item_type":"task"}]'::jsonb,
   '[{"type":"lab","code":"LOINC:2345-7","name":"Glucose"},{"type":"lab","code":"LOINC:6298-4","name":"Potassium"},{"type":"lab","code":"LOINC:24326-1","name":"Electrolytes panel"},{"type":"lab","code":"LOINC:53016-1","name":"Beta-hydroxybutyrate"}]'::jsonb,
   '[{"condition":"K+ < 3.3","severity":"critical","message":"Hold insulin until potassium repleted"},{"condition":"glucose drop > 5 mmol/h","severity":"high","message":"Excessive glucose decline — review insulin rate"}]'::jsonb),

  (gen_random_uuid(), null, 'Community-Acquired Pneumonia', 'pneumonia-cap', 'respiratory',
   array['CA40'], 'Pneumonia pathway: severity score, labs/imaging, antimicrobials, admission criteria',
   true, true, 1,
   '[{"order":1,"title":"Assess severity (CURB-65 / local score)","type":"assessment"},{"order":2,"title":"Oxygen saturation + vitals","type":"task"},{"order":3,"title":"Chest imaging","type":"order"},{"order":4,"title":"Labs: FBC, CRP, electrolytes, blood culture if severe","type":"order"},{"order":5,"title":"Empiric antibiotics per UCG","type":"order"},{"order":6,"title":"Admission vs outpatient decision","type":"assessment"},{"order":7,"title":"Follow-up / discharge criteria","type":"documentation"}]'::jsonb,
   '[{"field":"spo2","operator":"<","value":92},{"field":"respiratory_rate","operator":">=","value":30}]'::jsonb,
   '[{"title":"Severity scored","item_type":"assessment"},{"title":"Imaging ordered/reviewed","item_type":"order"},{"title":"Antibiotics started","item_type":"order"},{"title":"Disposition documented","item_type":"documentation"}]'::jsonb,
   '[{"type":"imaging","code":"XR-CHEST","name":"Chest X-ray"},{"type":"lab","code":"LOINC:58410-2","name":"CBC panel"},{"type":"lab","code":"LOINC:1988-5","name":"CRP"},{"type":"drug","code":"ATC:J01CR02","name":"Amoxicillin-clavulanate"}]'::jsonb,
   '[{"condition":"spo2 < 88","severity":"critical","message":"Severe hypoxia — escalate oxygen/ICU review"},{"condition":"curb65 >= 3","severity":"high","message":"High severity — consider admission"}]'::jsonb)
ON CONFLICT (slug) WHERE hospital_id IS NULL DO NOTHING;
