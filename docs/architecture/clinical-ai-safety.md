# Clinical AI Safety & Terminology (Phases 5 & 6)

## Phase 5 — ICD-11 backbone (without flattening clinical meaning)
Keep clinical concepts distinct — chief complaint, symptom, history finding, examination finding,
lab finding, imaging finding, differential / provisional / confirmed / ruled-out diagnosis, PMH,
family history, cause of death. Today only a single `encounter_diagnoses(icd11_code, certainty)`
table exists (audit §5).

Every structured clinical record must preserve: original patient wording, original clinician
wording, normalised term, ICD-11 code (where applicable), WHO entity URI, postcoordination
expression, ICD release/version, coding status, verification status, certainty, severity,
laterality, onset, duration, source, author, audit history.

**Measurements are not diagnoses.** BP, temperature, SpO₂, weight, glucose and lab values keep
value, unit, method, reference range, device, datetime, performer, abnormal flag, provenance.
Do not overwrite numeric observations with ICD codes.

Build: ICD terminology adapter, WHO API adapter, local terminology cache, offline search,
release pinning, code-migration tools, search/autocomplete, clinician-confirmation UI, mapping
audit, and original-code preservation for imported UgandaEMR/eAFYA data.
**AI never silently assigns a final clinical code** — a clinician confirms.

Migration shape (additive): a `clinical_terms` table (concept kind + the fields above) linked to
encounters/observations, plus ICD columns (`who_uri`, `postcoordination`, `icd_release`,
`coding_status`, `verification_status`) added to the diagnoses table.

## Phase 6/9 — Patient Trajectory Engine (evidence-grounded)
Reason over the patient's history while staying clinician-controlled. Outputs are grouped as:
established facts, important trends, possible relationships, unresolved problems, safety alerts,
missing information, suggested questions, suggested investigations, follow-up needs — **each
statement linked to the exact source** (encounter/observation/result/medicine/referral).

Architecture layers: structured clinical query layer → deterministic safety rules → temporal
reasoning → retrieval → **model-independent AI gateway** → guardrails → prompt/version registry
→ evaluation suite → human confirmation → audit log. No single LLM is the database or decision engine.

**Model-independent AI gateway** supports: a local/open-source text model, optional
NVIDIA-hosted/optimised models, imaging via MONAI-compatible services, small deterministic risk
models, a rules engine, and model fallbacks. Never train on production PHI by default; never send
identifiable records to an external model without an approved configuration + data-processing controls.

**Evaluation datasets (synthetic)** must cover: hallucination, missing evidence, wrong-patient
leakage, cross-tenant leakage, temporal errors, unsafe medication suggestions, incorrect certainty,
prompt injection. CI runs these as gates before any AI output surface ships.
