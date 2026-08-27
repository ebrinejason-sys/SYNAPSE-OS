# Synapse Pathways spec

Three layers:

1. **Guideline** — evidence/source (`guideline_source`)
2. **Pathway** — versioned implementation workflow
3. **Patient care plan** — the version actually started for that encounter

The first implemented pathway is **adult suspected sepsis** (`pathway.adult-sepsis` v1.0.0). Content is a teaching set, not a licensed protocol dump.

Overrides store `recommended_action`, `actual_action`, `override_reason`, `clinician_id`, `timestamp`, `pathway_id`, `pathway_version`, `patient_context_reference`. `may_train_models` is always false unless a later governance process changes it.

The clinician remains in control. Pathways recommend investigations and treatments; they do not sign, verify, or dispense.
