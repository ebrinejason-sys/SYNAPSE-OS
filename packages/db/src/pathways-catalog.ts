/**
 * Adapted teaching pathways. Provenance is cited; copyrighted chapters are not reproduced.
 */

import type { ClinicalPathwayDefinition, GuidelineSource, PathwayStepDefinition } from "./pathways"

const UCG: Omit<GuidelineSource, "id" | "name"> = {
  organization: "Uganda Clinical Guidelines (adapted teaching set)",
  version: "teaching-2026.1",
  publishedOn: "2026-01-15",
  url: null,
}

const WHO: Omit<GuidelineSource, "id" | "name"> = {
  organization: "WHO (adapted teaching set)",
  version: "teaching-2026.1",
  publishedOn: "2026-01-15",
  url: null,
}

function steps(rows: Array<Omit<PathwayStepDefinition, "sequence"> & { sequence?: number }>): PathwayStepDefinition[] {
  return rows.map((row, index) => ({ ...row, sequence: row.sequence ?? index + 1 }))
}

function pathway(input: {
  slug: string
  name: string
  specialty: string
  guidelineName: string
  source: Omit<GuidelineSource, "id" | "name">
  triggers: string[]
  rows: Array<Omit<PathwayStepDefinition, "sequence" | "id"> & { id: string }>
}): ClinicalPathwayDefinition {
  return {
    id: `pathway.${input.slug}`,
    name: input.name,
    specialty: input.specialty,
    version: "1.0.0",
    source: {
      id: `guideline.${input.slug}.teaching`,
      name: input.guidelineName,
      ...input.source,
    },
    sourceVersion: input.source.version,
    effectiveDate: "2026-09-01",
    reviewDate: "2027-09-01",
    status: "active",
    countryPack: "UG",
    author: "SYNAPSE clinical content (adapted teaching)",
    reviewer: "clinician-in-control",
    triggers: input.triggers,
    steps: steps(input.rows),
  }
}

export const EXPANDED_PATHWAYS: ClinicalPathwayDefinition[] = [
  pathway({
    slug: "hypertensive-emergency",
    name: "Hypertensive emergency",
    specialty: "emergency / internal medicine",
    guidelineName: "Severe hypertension with target-organ damage (adapted teaching set)",
    source: UCG,
    triggers: ["severe_hypertension", "bp>=180/120", "encephalopathy", "chest_pain", "acute_kidney_injury"],
    rows: [
      { id: "assess", name: "Assessment", required: true, actionKind: "observation", instruction: "Confirm BP, symptoms of end-organ damage, pregnancy status. Clinician confirms pathway start.", recommendedAction: "Repeat BP and assess target-organ symptoms" },
      { id: "investigate", name: "Investigations", required: true, actionKind: "lab_order", instruction: "Creatinine, electrolytes, urinalysis, ECG. Do not delay blood-pressure control for imaging if the clinician has diagnosed emergency.", recommendedAction: "Order creatinine, electrolytes, and ECG", orderSet: [{ loincCode: "2160-0", testName: "Creatinine", urgency: "STAT" }, { loincCode: "34534-8", testName: "ECG", urgency: "STAT" }] },
      { id: "imaging", name: "Imaging if indicated", required: false, actionKind: "imaging_order", instruction: "CT brain only if focal neurology. Clinician confirms the order.", recommendedAction: "Consider CT brain if focal neurology" },
      { id: "treat", name: "Blood pressure control", required: true, actionKind: "medication", instruction: "Controlled reduction per local protocol. Clinician prescribes. Avoid abrupt collapse of BP.", recommendedAction: "Prescribe controlled IV antihypertensive per local protocol", orderSet: [{ medicationDisplay: "IV antihypertensive per local protocol", urgency: "STAT" }] },
      { id: "monitor", name: "Monitoring", required: true, actionKind: "monitoring", instruction: "Repeat BP and neurology. Watch for overshoot hypotension.", recommendedAction: "Repeat BP every 15 minutes until stable" },
      { id: "outcome", name: "Outcome", required: true, actionKind: "outcome", instruction: "Record control, admission, or referral.", recommendedAction: "Record hypertensive-emergency outcome" },
    ],
  }),
  pathway({
    slug: "acs",
    name: "Acute coronary syndrome",
    specialty: "emergency / cardiology",
    guidelineName: "Suspected ACS (adapted teaching set)",
    source: WHO,
    triggers: ["chest_pain", "diaphoresis", "st_elevation", "troponin_positive", "radiation_to_arm"],
    rows: [
      { id: "assess", name: "Assessment", required: true, actionKind: "observation", instruction: "ABC, pain character, ECG access. Clinician confirms ACS pathway.", recommendedAction: "Obtain 12-lead ECG and record pain onset" },
      { id: "investigate", name: "Investigations", required: true, actionKind: "lab_order", instruction: "Troponin and ECG. Do not delay aspirin if the clinician diagnoses ACS.", recommendedAction: "Order STAT troponin", orderSet: [{ loincCode: "6598-7", testName: "Troponin I", urgency: "STAT" }] },
      { id: "treat", name: "Immediate therapy", required: true, actionKind: "medication", instruction: "Aspirin unless contraindicated. Further agents per clinician and local protocol.", recommendedAction: "Prescribe aspirin 300 mg chewed after clinician confirmation", orderSet: [{ medicationDisplay: "Aspirin 300 mg", urgency: "STAT" }] },
      { id: "referral", name: "Reperfusion / referral", required: true, actionKind: "referral", instruction: "STEMI needs reperfusion or urgent referral. AI cannot refer.", recommendedAction: "Activate reperfusion or urgent cardiac referral" },
      { id: "monitor", name: "Monitoring", required: true, actionKind: "monitoring", instruction: "Continuous monitoring, repeat ECG if pain recurs.", recommendedAction: "Monitor rhythm and repeat ECG if pain recurs" },
      { id: "outcome", name: "Outcome", required: true, actionKind: "outcome", instruction: "Record reperfusion, admission, or death.", recommendedAction: "Record ACS pathway outcome" },
    ],
  }),
  pathway({
    slug: "stroke",
    name: "Acute stroke",
    specialty: "emergency / neurology",
    guidelineName: "Acute stroke recognition and referral (adapted teaching set)",
    source: WHO,
    triggers: ["focal_weakness", "speech_disturbance", "facial_droop", "sudden_confusion", "nihss"],
    rows: [
      { id: "assess", name: "Assessment", required: true, actionKind: "observation", instruction: "Time last known well, glucose, FAST/NIHSS. Clinician confirms stroke pathway.", recommendedAction: "Record last known well and bedside glucose" },
      { id: "investigate", name: "Investigations", required: true, actionKind: "lab_order", instruction: "Glucose, coagulation if available. Imaging is the key next step.", recommendedAction: "Order glucose and coagulation screen", orderSet: [{ loincCode: "2345-7", testName: "Glucose", urgency: "STAT" }] },
      { id: "imaging", name: "Brain imaging", required: true, actionKind: "imaging_order", instruction: "Non-contrast CT when available. Do not delay transfer if imaging is unavailable locally.", recommendedAction: "Order non-contrast CT brain or arrange transfer" },
      { id: "treat", name: "Supportive care", required: true, actionKind: "medication", instruction: "Airway, glucose, avoid hypotonic fluids. Thrombolysis only if a capable clinician and protocol exist.", recommendedAction: "Support ABC and correct hypoglycaemia" },
      { id: "referral", name: "Stroke unit / referral", required: true, actionKind: "referral", instruction: "Refer to the highest available stroke-capable facility.", recommendedAction: "Refer to stroke-capable facility" },
      { id: "outcome", name: "Outcome", required: true, actionKind: "outcome", instruction: "Record imaging result and destination.", recommendedAction: "Record stroke pathway outcome" },
    ],
  }),
  pathway({
    slug: "asthma-exacerbation",
    name: "Asthma exacerbation",
    specialty: "emergency / respiratory",
    guidelineName: "Acute asthma (adapted teaching set)",
    source: UCG,
    triggers: ["wheeze", "dyspnoea", "peak_flow_low", "silent_chest", "known_asthma"],
    rows: [
      { id: "assess", name: "Assessment", required: true, actionKind: "observation", instruction: "RR, SpO2, speech, peak flow if available. Clinician confirms severity.", recommendedAction: "Grade severity using RR, SpO2, and ability to speak" },
      { id: "treat", name: "Bronchodilators and oxygen", required: true, actionKind: "medication", instruction: "Oxygen to target SpO2. Salbutamol via spacer/nebuliser. Clinician prescribes steroids.", recommendedAction: "Give oxygen and salbutamol; prescribe systemic corticosteroid", orderSet: [{ medicationDisplay: "Salbutamol nebuliser/spacer", urgency: "STAT" }, { medicationDisplay: "Prednisolone or hydrocortisone", urgency: "STAT" }] },
      { id: "monitor", name: "Monitoring", required: true, actionKind: "monitoring", instruction: "Repeat observations after bronchodilators. Silent chest is a danger sign.", recommendedAction: "Repeat SpO2 and work of breathing after first treatment" },
      { id: "escalate", name: "Escalation", required: false, actionKind: "escalation", instruction: "Life-threatening features need senior review and possible magnesium/ICU.", recommendedAction: "Escalate life-threatening asthma to senior clinician" },
      { id: "outcome", name: "Outcome", required: true, actionKind: "outcome", instruction: "Record response, admission, or discharge with preventer plan.", recommendedAction: "Record asthma pathway outcome" },
    ],
  }),
  pathway({
    slug: "copd-exacerbation",
    name: "COPD exacerbation",
    specialty: "emergency / respiratory",
    guidelineName: "Acute COPD exacerbation (adapted teaching set)",
    source: WHO,
    triggers: ["known_copd", "productive_cough", "hypercapnia", "wheeze", "smoking_history"],
    rows: [
      { id: "assess", name: "Assessment", required: true, actionKind: "observation", instruction: "Controlled oxygen, work of breathing, infection signs. Clinician confirms COPD pathway.", recommendedAction: "Titrate oxygen and record RR/SpO2" },
      { id: "investigate", name: "Investigations", required: true, actionKind: "lab_order", instruction: "CBC. Blood gas if available. CXR for pneumonia/pneumothorax.", recommendedAction: "Order CBC and consider CXR", orderSet: [{ loincCode: "6690-2", testName: "WBC", urgency: "URGENT" }] },
      { id: "treat", name: "Treatment", required: true, actionKind: "medication", instruction: "Bronchodilators, steroids, antibiotics if purulent sputum per clinician.", recommendedAction: "Prescribe bronchodilators and systemic corticosteroid", orderSet: [{ medicationDisplay: "Salbutamol + ipratropium", urgency: "STAT" }] },
      { id: "monitor", name: "Monitoring", required: true, actionKind: "monitoring", instruction: "Watch for CO2 retention if uncontrolled oxygen is used.", recommendedAction: "Repeat SpO2 and work of breathing" },
      { id: "outcome", name: "Outcome", required: true, actionKind: "outcome", instruction: "Record admission or supported discharge.", recommendedAction: "Record COPD pathway outcome" },
    ],
  }),
  pathway({
    slug: "acute-heart-failure",
    name: "Acute heart failure",
    specialty: "emergency / cardiology",
    guidelineName: "Acute heart failure (adapted teaching set)",
    source: WHO,
    triggers: ["orthopnoea", "pulmonary_oedema", "raised_jvp", "hypoxia", "known_heart_failure"],
    rows: [
      { id: "assess", name: "Assessment", required: true, actionKind: "observation", instruction: "ABC, oxygen, volume status. Clinician confirms acute heart-failure pathway.", recommendedAction: "Sit up, give oxygen, record BP and SpO2" },
      { id: "investigate", name: "Investigations", required: true, actionKind: "lab_order", instruction: "ECG, electrolytes, creatinine. CXR when available.", recommendedAction: "Order ECG, electrolytes, and creatinine", orderSet: [{ loincCode: "2823-3", testName: "Potassium", urgency: "STAT" }, { loincCode: "2160-0", testName: "Creatinine", urgency: "STAT" }] },
      { id: "treat", name: "Treatment", required: true, actionKind: "medication", instruction: "Nitrates/diuretic only after clinician assessment of BP and perfusion.", recommendedAction: "Prescribe diuretic or nitrate per perfusion and BP", orderSet: [{ medicationDisplay: "Furosemide IV", urgency: "STAT" }] },
      { id: "monitor", name: "Monitoring", required: true, actionKind: "monitoring", instruction: "Urine output, BP, work of breathing.", recommendedAction: "Monitor BP, urine output, and oxygen need" },
      { id: "outcome", name: "Outcome", required: true, actionKind: "outcome", instruction: "Record response or ICU/referral.", recommendedAction: "Record heart-failure pathway outcome" },
    ],
  }),
  pathway({
    slug: "aki",
    name: "Acute kidney injury",
    specialty: "internal medicine / emergency",
    guidelineName: "Acute kidney injury recognition (adapted teaching set)",
    source: UCG,
    triggers: ["oliguria", "raised_creatinine", "hyperkalaemia", "anuria", "uremia"],
    rows: [
      { id: "assess", name: "Assessment", required: true, actionKind: "observation", instruction: "Volume status, obstruction, nephrotoxins. Clinician confirms AKI pathway.", recommendedAction: "Assess volume, catheterise if obstruction suspected" },
      { id: "investigate", name: "Investigations", required: true, actionKind: "lab_order", instruction: "Creatinine, potassium, urinalysis. Repeat if the first result is critical.", recommendedAction: "Order STAT creatinine and potassium", orderSet: [{ loincCode: "2160-0", testName: "Creatinine", urgency: "STAT" }, { loincCode: "2823-3", testName: "Potassium", urgency: "STAT" }] },
      { id: "treat", name: "Treatment", required: true, actionKind: "medication", instruction: "Stop nephrotoxins. Fluids if hypovolaemic. Treat hyperkalaemia as an emergency.", recommendedAction: "Treat hyperkalaemia and restore volume if depleted" },
      { id: "referral", name: "Dialysis / referral", required: false, actionKind: "referral", instruction: "Indications for dialysis or higher-level care remain a clinician decision.", recommendedAction: "Refer if dialysis indications are present" },
      { id: "monitor", name: "Monitoring", required: true, actionKind: "monitoring", instruction: "Urine output and repeat potassium.", recommendedAction: "Repeat potassium and urine output" },
      { id: "outcome", name: "Outcome", required: true, actionKind: "outcome", instruction: "Record recovery, dialysis, or death.", recommendedAction: "Record AKI pathway outcome" },
    ],
  }),
  pathway({
    slug: "meningitis",
    name: "Suspected meningitis",
    specialty: "emergency / infectious disease",
    guidelineName: "Acute meningitis (adapted teaching set)",
    source: WHO,
    triggers: ["neck_stiffness", "photophobia", "fever", "altered_mental_status", "petechiae"],
    rows: [
      { id: "assess", name: "Assessment", required: true, actionKind: "observation", instruction: "ABC, rash, HIV status, contraindications to LP. Clinician confirms meningitis pathway.", recommendedAction: "Record GCS, rash, and LP contraindications" },
      { id: "investigate", name: "Investigations", required: true, actionKind: "lab_order", instruction: "Glucose, blood culture if available. LP only after clinician decision.", recommendedAction: "Order glucose and prepare LP if no contraindication", orderSet: [{ loincCode: "2345-7", testName: "Glucose", urgency: "STAT" }] },
      { id: "treat", name: "Antibiotics", required: true, actionKind: "medication", instruction: "Do not delay antimicrobials for imaging if the clinician diagnoses bacterial meningitis.", recommendedAction: "Prescribe empiric IV antimicrobial per local protocol", orderSet: [{ medicationDisplay: "Ceftriaxone IV", urgency: "STAT" }] },
      { id: "monitor", name: "Monitoring", required: true, actionKind: "monitoring", instruction: "Neurology and fluids. Isolate if indicated.", recommendedAction: "Repeat GCS and vital signs" },
      { id: "outcome", name: "Outcome", required: true, actionKind: "outcome", instruction: "Record CSF result and clinical course.", recommendedAction: "Record meningitis pathway outcome" },
    ],
  }),
  pathway({
    slug: "severe-malaria",
    name: "Severe malaria",
    specialty: "emergency / infectious disease",
    guidelineName: "Severe malaria (adapted teaching set)",
    source: WHO,
    triggers: ["malaria_positive", "prostration", "convulsions", "severe_anaemia", "acidosis", "hypoglycaemia"],
    rows: [
      { id: "assess", name: "Assessment", required: true, actionKind: "observation", instruction: "Danger signs, pregnancy, glucose. Distinct from uncomplicated malaria. Clinician confirms.", recommendedAction: "Record danger signs and bedside glucose" },
      { id: "investigate", name: "Investigations", required: true, actionKind: "lab_order", instruction: "Confirm malaria, Hb, glucose, creatinine if available.", recommendedAction: "Order malaria test, haemoglobin, and glucose", orderSet: [{ loincCode: "58413-6", testName: "Malaria Pf antigen", urgency: "STAT" }, { loincCode: "718-7", testName: "Haemoglobin", urgency: "STAT" }] },
      { id: "treat", name: "Parenteral artesunate", required: true, actionKind: "medication", instruction: "Parenteral artesunate then complete oral ACT. Clinician prescribes.", recommendedAction: "Prescribe parenteral artesunate", orderSet: [{ medicationDisplay: "Artesunate IV", urgency: "STAT" }] },
      { id: "monitor", name: "Monitoring", required: true, actionKind: "monitoring", instruction: "Glucose, fluids, convulsions.", recommendedAction: "Repeat glucose and observations" },
      { id: "outcome", name: "Outcome", required: true, actionKind: "outcome", instruction: "Record recovery or complications.", recommendedAction: "Record severe-malaria outcome" },
    ],
  }),
  pathway({
    slug: "upper-gi-bleed",
    name: "Upper GI bleed",
    specialty: "emergency / gastroenterology",
    guidelineName: "Acute upper gastrointestinal bleeding (adapted teaching set)",
    source: UCG,
    triggers: ["haematemesis", "melaena", "shock", "known_ulcer", "liver_disease"],
    rows: [
      { id: "assess", name: "Assessment", required: true, actionKind: "observation", instruction: "ABC, shock, liver disease. Clinician confirms GI-bleed pathway.", recommendedAction: "Resuscitate and record shock index" },
      { id: "investigate", name: "Investigations", required: true, actionKind: "lab_order", instruction: "Hb, group and screen. Do not wait for Hb before resuscitation.", recommendedAction: "Order haemoglobin and group and screen", orderSet: [{ loincCode: "718-7", testName: "Haemoglobin", urgency: "STAT" }] },
      { id: "treat", name: "Stabilisation", required: true, actionKind: "medication", instruction: "IV access, fluids/blood per clinician. PPI after assessment.", recommendedAction: "Secure IV access and prescribe PPI if indicated", orderSet: [{ medicationDisplay: "Omeprazole IV", urgency: "STAT" }] },
      { id: "referral", name: "Endoscopy / referral", required: true, actionKind: "referral", instruction: "Urgent endoscopy or surgical referral as available.", recommendedAction: "Arrange endoscopy or surgical referral" },
      { id: "outcome", name: "Outcome", required: true, actionKind: "outcome", instruction: "Record haemostasis or transfer.", recommendedAction: "Record GI-bleed pathway outcome" },
    ],
  }),
  pathway({
    slug: "poisoning",
    name: "Acute poisoning",
    specialty: "emergency / toxicology",
    guidelineName: "Acute poisoning first response (adapted teaching set)",
    source: WHO,
    triggers: ["ingestion", "unknown_poison", "pesticide", "altered_mental_status", "toxidrome"],
    rows: [
      { id: "assess", name: "Assessment", required: true, actionKind: "observation", instruction: "ABC, toxidrome, what/when ingested. This is a clinical and medicolegal pathway; AI does not determine intent.", recommendedAction: "Secure airway and identify the exposure" },
      { id: "investigate", name: "Investigations", required: true, actionKind: "lab_order", instruction: "Glucose, electrolytes. Specific assays only if available and indicated.", recommendedAction: "Order glucose and electrolytes", orderSet: [{ loincCode: "2345-7", testName: "Glucose", urgency: "STAT" }] },
      { id: "treat", name: "Decontamination / antidote", required: true, actionKind: "medication", instruction: "Antidote only after clinician identification of the toxin. No routine forced emesis.", recommendedAction: "Give indicated antidote after clinician confirmation" },
      { id: "monitor", name: "Monitoring", required: true, actionKind: "monitoring", instruction: "Observe for delayed toxicity. Flag medicolegal review if indicated.", recommendedAction: "Monitor GCS and vital signs" },
      { id: "outcome", name: "Outcome", required: true, actionKind: "outcome", instruction: "Record antidote, transfer, or recovery.", recommendedAction: "Record poisoning pathway outcome" },
    ],
  }),
  pathway({
    slug: "snakebite",
    name: "Snakebite",
    specialty: "emergency / toxicology",
    guidelineName: "Snakebite first response (adapted teaching set)",
    source: WHO,
    triggers: ["snakebite", "fang_marks", "coagulopathy", "neurotoxicity", "local_swelling"],
    rows: [
      { id: "assess", name: "Assessment", required: true, actionKind: "observation", instruction: "Immobilise limb, time of bite, neuro vs haemotoxic signs. Clinician confirms.", recommendedAction: "Immobilise the bitten limb and record the time of bite" },
      { id: "investigate", name: "Investigations", required: true, actionKind: "lab_order", instruction: "20-minute whole-blood clotting test where used. Hb if bleeding.", recommendedAction: "Perform WBCT20 if locally used", orderSet: [{ loincCode: "718-7", testName: "Haemoglobin", urgency: "URGENT" }] },
      { id: "treat", name: "Antivenom", required: true, actionKind: "medication", instruction: "Antivenom only with systemic or severe local envenoming after clinician decision.", recommendedAction: "Prescribe antivenom if envenoming is confirmed by the clinician", orderSet: [{ medicationDisplay: "Polyvalent antivenom", urgency: "STAT" }] },
      { id: "monitor", name: "Monitoring", required: true, actionKind: "monitoring", instruction: "Watch anaphylaxis and recurrent coagulopathy.", recommendedAction: "Observe for anaphylaxis and repeat clotting assessment" },
      { id: "outcome", name: "Outcome", required: true, actionKind: "outcome", instruction: "Record antivenom doses and complications.", recommendedAction: "Record snakebite pathway outcome" },
    ],
  }),
  pathway({
    slug: "trauma",
    name: "Major trauma",
    specialty: "emergency / surgery",
    guidelineName: "Primary trauma survey (adapted teaching set)",
    source: WHO,
    triggers: ["major_trauma", "rta", "penetrating_injury", "hypotension", "gcs_low"],
    rows: [
      { id: "assess", name: "Primary survey", required: true, actionKind: "observation", instruction: "ABCDE. Massive haemorrhage control. Clinician leads; AI cannot run the trauma bay.", recommendedAction: "Complete ABCDE primary survey" },
      { id: "investigate", name: "Investigations", required: true, actionKind: "lab_order", instruction: "Hb, group and screen. Imaging after primary survey.", recommendedAction: "Order haemoglobin and group and screen", orderSet: [{ loincCode: "718-7", testName: "Haemoglobin", urgency: "STAT" }] },
      { id: "procedure", name: "Procedures", required: false, actionKind: "procedure", instruction: "Chest decompression, wound control, pelvic binder as indicated by the clinician.", recommendedAction: "Perform indicated life-saving procedure after clinician decision" },
      { id: "referral", name: "Surgical referral", required: true, actionKind: "referral", instruction: "Transfer to surgical capability when local capacity is exceeded.", recommendedAction: "Refer to surgical capability" },
      { id: "monitor", name: "Monitoring", required: true, actionKind: "monitoring", instruction: "Repeat primary survey after interventions.", recommendedAction: "Repeat ABCDE after each intervention" },
      { id: "outcome", name: "Outcome", required: true, actionKind: "outcome", instruction: "Record disposition and injuries.", recommendedAction: "Record trauma pathway outcome" },
    ],
  }),
  pathway({
    slug: "tuberculosis",
    name: "Presumptive tuberculosis",
    specialty: "outpatient / infectious disease",
    guidelineName: "Presumptive TB evaluation (adapted teaching set)",
    source: WHO,
    triggers: ["chronic_cough", "night_sweats", "weight_loss", "haemoptysis", "tb_contact"],
    rows: [
      { id: "assess", name: "Assessment", required: true, actionKind: "observation", instruction: "Cough duration, HIV, contacts. Clinician confirms TB pathway.", recommendedAction: "Record cough duration, HIV status, and contacts" },
      { id: "investigate", name: "Investigations", required: true, actionKind: "lab_order", instruction: "Xpert/smear per national algorithm. CXR when available.", recommendedAction: "Order WHO/NTRL-aligned TB test", orderSet: [{ testName: "GeneXpert MTB/RIF", urgency: "URGENT" }] },
      { id: "treat", name: "Treatment", required: true, actionKind: "medication", instruction: "Start TB treatment only after clinician confirmation of the algorithm result.", recommendedAction: "Prescribe first-line TB regimen after clinician confirmation" },
      { id: "monitor", name: "Monitoring", required: true, actionKind: "monitoring", instruction: "Adherence and adverse effects. Notify the national programme as required.", recommendedAction: "Plan follow-up and adverse-effect monitoring" },
      { id: "outcome", name: "Outcome", required: true, actionKind: "outcome", instruction: "Record bacteriologic result and treatment start.", recommendedAction: "Record TB pathway outcome" },
    ],
  }),
  pathway({
    slug: "hiv",
    name: "HIV testing and linkage",
    specialty: "outpatient / infectious disease",
    guidelineName: "HIV testing and ART linkage (adapted teaching set)",
    source: WHO,
    triggers: ["hiv_unknown", "sti", "tb_presumptive", "pregnancy", "index_testing"],
    rows: [
      { id: "assess", name: "Assessment", required: true, actionKind: "observation", instruction: "Consented testing offer. Clinician remains in control of disclosure.", recommendedAction: "Offer consented HIV testing" },
      { id: "investigate", name: "Investigations", required: true, actionKind: "lab_order", instruction: "National testing algorithm. Same-day ART only after clinician confirmation.", recommendedAction: "Order HIV rapid/algorithm test", orderSet: [{ loincCode: "75622-1", testName: "HIV rapid test", urgency: "URGENT" }] },
      { id: "treat", name: "ART linkage", required: true, actionKind: "medication", instruction: "ART prescription is a clinician act. AI cannot start ART.", recommendedAction: "Link to ART after clinician confirmation" },
      { id: "monitor", name: "Monitoring", required: true, actionKind: "monitoring", instruction: "Adherence and opportunistic infection screen.", recommendedAction: "Plan ART follow-up" },
      { id: "outcome", name: "Outcome", required: true, actionKind: "outcome", instruction: "Record test result handling and linkage.", recommendedAction: "Record HIV pathway outcome" },
    ],
  }),
  pathway({
    slug: "anaemia",
    name: "Severe anaemia",
    specialty: "emergency / internal medicine",
    guidelineName: "Severe anaemia evaluation (adapted teaching set)",
    source: UCG,
    triggers: ["severe_pallor", "haemoglobin_low", "malaria", "heart_failure_symptoms", "pregnancy"],
    rows: [
      { id: "assess", name: "Assessment", required: true, actionKind: "observation", instruction: "Cause hunt: malaria, bleeding, nutrition, chronic disease. Clinician confirms.", recommendedAction: "Assess bleeding, malaria risk, and cardiac compensation" },
      { id: "investigate", name: "Investigations", required: true, actionKind: "lab_order", instruction: "Hb, malaria test, blood film if available.", recommendedAction: "Order haemoglobin and malaria test", orderSet: [{ loincCode: "718-7", testName: "Haemoglobin", urgency: "STAT" }, { loincCode: "58413-6", testName: "Malaria Pf antigen", urgency: "STAT" }] },
      { id: "treat", name: "Transfusion decision", required: true, actionKind: "procedure", instruction: "Transfusion threshold is a clinician decision. This PR does not add a blood-bank engine.", recommendedAction: "Decide on transfusion using local thresholds" },
      { id: "monitor", name: "Monitoring", required: true, actionKind: "monitoring", instruction: "Repeat Hb and work of breathing.", recommendedAction: "Repeat haemoglobin and observations" },
      { id: "outcome", name: "Outcome", required: true, actionKind: "outcome", instruction: "Record cause and response.", recommendedAction: "Record anaemia pathway outcome" },
    ],
  }),
  pathway({
    slug: "neonatal-emergency",
    name: "Neonatal emergency",
    specialty: "neonatal / paediatric emergency",
    guidelineName: "Helping babies breathe / neonatal emergency (adapted teaching set)",
    source: WHO,
    triggers: ["newborn", "apnoea", "hypothermia", "sepsis_risk", "birth_asphyxia"],
    rows: [
      { id: "assess", name: "Assessment", required: true, actionKind: "observation", instruction: "Warm, dry, stimulate, assess breathing/HR. Clinician leads resuscitation.", recommendedAction: "Start neonatal ABC: warmth, airway, breathing" },
      { id: "treat", name: "Resuscitation", required: true, actionKind: "procedure", instruction: "Bag-mask ventilation per protocol. Adrenaline only after clinician decision.", recommendedAction: "Provide bag-mask ventilation if not breathing" },
      { id: "investigate", name: "Investigations", required: false, actionKind: "lab_order", instruction: "Glucose and sepsis workup after the baby is breathing.", recommendedAction: "Check glucose once airway is secure", orderSet: [{ loincCode: "2345-7", testName: "Glucose", urgency: "STAT" }] },
      { id: "monitor", name: "Monitoring", required: true, actionKind: "monitoring", instruction: "Temperature, glucose, breathing.", recommendedAction: "Maintain warmth and repeat HR/respiratory effort" },
      { id: "outcome", name: "Outcome", required: true, actionKind: "outcome", instruction: "Record resuscitation steps and destination.", recommendedAction: "Record neonatal emergency outcome" },
    ],
  }),
  pathway({
    slug: "obstetric-hemorrhage",
    name: "Obstetric hemorrhage",
    specialty: "maternity / emergency",
    guidelineName: "Obstetric haemorrhage (adapted teaching set)",
    source: WHO,
    triggers: ["antepartum_bleed", "postpartum_bleed", "shock_in_pregnancy", "retained_placenta"],
    rows: [
      { id: "assess", name: "Assessment", required: true, actionKind: "observation", instruction: "ABC, estimate blood loss, uterine tone, placenta. Clinician confirms.", recommendedAction: "Call for help and assess ABC and uterine tone" },
      { id: "treat", name: "Uterotonics and blood", required: true, actionKind: "medication", instruction: "Oxytocin and mechanical measures. Blood products remain a clinician/blood-bank decision outside this PR.", recommendedAction: "Give oxytocin and perform uterine massage", orderSet: [{ medicationDisplay: "Oxytocin IV", urgency: "STAT" }] },
      { id: "procedure", name: "Procedures", required: true, actionKind: "procedure", instruction: "Remove retained placenta, balloon, or theatre as indicated.", recommendedAction: "Perform indicated obstetric procedure" },
      { id: "referral", name: "Theatre / referral", required: false, actionKind: "referral", instruction: "Uncontrolled bleeding needs surgical capability.", recommendedAction: "Escalate to theatre or referral" },
      { id: "outcome", name: "Outcome", required: true, actionKind: "outcome", instruction: "Record blood loss and control.", recommendedAction: "Record obstetric-haemorrhage outcome" },
    ],
  }),
  pathway({
    slug: "pre-eclampsia",
    name: "Pre-eclampsia / eclampsia",
    specialty: "maternity / emergency",
    guidelineName: "Pre-eclampsia and eclampsia (adapted teaching set)",
    source: WHO,
    triggers: ["pregnancy_hypertension", "proteinuria", "seizure_in_pregnancy", "headache_visual", "epigastric_pain"],
    rows: [
      { id: "assess", name: "Assessment", required: true, actionKind: "observation", instruction: "BP, proteinuria, neurology, gestation. Clinician confirms.", recommendedAction: "Repeat BP and check proteinuria and reflexes" },
      { id: "investigate", name: "Investigations", required: true, actionKind: "lab_order", instruction: "Creatinine, platelets, liver enzymes.", recommendedAction: "Order creatinine, platelets, and liver enzymes", orderSet: [{ loincCode: "2160-0", testName: "Creatinine", urgency: "STAT" }, { loincCode: "777-3", testName: "Platelets", urgency: "STAT" }] },
      { id: "treat", name: "Magnesium and BP control", required: true, actionKind: "medication", instruction: "Magnesium sulphate for severe features/eclampsia. Antihypertensive per protocol. Clinician prescribes.", recommendedAction: "Prescribe magnesium sulphate if severe features or eclampsia", orderSet: [{ medicationDisplay: "Magnesium sulphate", urgency: "STAT" }] },
      { id: "referral", name: "Delivery planning", required: true, actionKind: "referral", instruction: "Definitive therapy is delivery planned by the obstetric clinician.", recommendedAction: "Plan delivery or refer to obstetric capability" },
      { id: "outcome", name: "Outcome", required: true, actionKind: "outcome", instruction: "Record seizures, BP control, and delivery plan.", recommendedAction: "Record pre-eclampsia pathway outcome" },
    ],
  }),
  pathway({
    slug: "postpartum-hemorrhage",
    name: "Postpartum hemorrhage",
    specialty: "maternity / emergency",
    guidelineName: "Postpartum haemorrhage (adapted teaching set)",
    source: WHO,
    triggers: ["pph", "atony", "bleeding_after_birth", "shock_postpartum"],
    rows: [
      { id: "assess", name: "Assessment", required: true, actionKind: "observation", instruction: "Four Ts: tone, trauma, tissue, thrombin. Clinician confirms PPH pathway.", recommendedAction: "Call for help and assess the four Ts" },
      { id: "treat", name: "Uterotonics", required: true, actionKind: "medication", instruction: "Oxytocin first-line. Additional agents per clinician.", recommendedAction: "Give oxytocin and empty the bladder", orderSet: [{ medicationDisplay: "Oxytocin IV", urgency: "STAT" }] },
      { id: "procedure", name: "Mechanical and surgical", required: true, actionKind: "procedure", instruction: "Bimanual compression, balloon, repair lacerations, theatre if needed.", recommendedAction: "Perform bimanual compression and inspect for trauma" },
      { id: "monitor", name: "Monitoring", required: true, actionKind: "monitoring", instruction: "Blood loss, BP, urine output.", recommendedAction: "Record ongoing blood loss and vital signs" },
      { id: "outcome", name: "Outcome", required: true, actionKind: "outcome", instruction: "Record control and any hysterectomy/referral.", recommendedAction: "Record PPH pathway outcome" },
    ],
  }),
]
