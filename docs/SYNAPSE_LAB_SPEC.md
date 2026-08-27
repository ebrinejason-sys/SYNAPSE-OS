# Synapse Lab spec

First vertical slice (not a full LIMS):

```
Clinician → Lab order → Worklist → Accession → Collection → Receipt
  → Processing → Result entry → Verification → Diagnostic report
  → Patient timeline → Clinician notification / critical acknowledgement
```

Workflow statuses live in `packages/db/src/lab-workflow.ts`. Existing `lab_orders.status` values are mapped (`ordered` / `collected` / `processing` / `resulted` / `verified` / `cancelled`) so the historical table is reused.

Safety:

- Reference ranges (age/sex where supplied)
- Abnormal and critical flags
- Analyzer / provenance
- Amendments with reason; no silent overwrite of verified results
- Critical results emit `CriticalLabResultDetected` and require acknowledgement
- AI is not a verifier

Roadmap (do not mark operational): hematology programmes, microbiology AST, pathology, blood bank, analyzer integration, QC/IQC/EQA, reagent inventory, biosafety, TAT analytics, ALIS replacement.
