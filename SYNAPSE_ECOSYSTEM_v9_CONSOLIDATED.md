# SYNAPSE ECOSYSTEM — CONSOLIDATED MASTER DEFINITION
## Version 9.0 | Synthesised from All Prior Specifications + New Modules

> **Two Products. One Ecosystem. Every Human. Every Hospital.**  
> Built in Uganda. Designed for the World.

---

## SECTION 1: WHAT SYNAPSE IS (The Definitive Statement)

Synapse is a **sovereign AI health ecosystem** made of two interconnected products:

| Product | Users | Purpose |
|---|---|---|
| **Synapse OS** | Hospitals, Clinics, Care Homes, Labs, Pharmacies | Full HMIS + AI Clinical Workspace. Every department. Every workflow. Every patient step. |
| **Synapse App** | Patients, Community, Caregivers, Staff (mobile) | Personal health companion. Telemedicine. Device monitoring. Insurance. Public health. |

They communicate bidirectionally via REST + FHIR APIs. Data flows only with explicit consent. Every action is audited.

---

## SECTION 2: WHAT IS NEW IN THIS SYNTHESIS

Everything from v7 and v8 is retained. These are the **net additions** from the uploaded documents:

### 2.1 Clinical Scoring Module (150+ Validated Scores)

A dedicated **Clinical Scoring & AI Interpretation Module** is now a first-class feature. It is not a sidebar — it is embedded in every relevant department workspace.

**Score catalogue (pre-loaded into `score_definitions` table):**

**Cardiology & Vascular:**
TIMI, GRACE, HEART, CHA₂DS₂-VASc, HAS-BLED, CRUSADE, Duke Treadmill, Framingham Risk, ASCVD/Pooled Cohort, Wells DVT, Wells PE, PERC Rule, Revised Geneva, Padua, NYHA

**Neurology:**
NIHSS, GCS, ICH Score, Hunt & Hess, FOUR Score, ABCD², WFNS SAH, Fisher Scale, ASPECTS, Modified Rankin Scale

**Critical Care / Pulmonology:**
APACHE II, SOFA, qSOFA, SIRS, CURB-65, PSI/PORT, SMART-COP, BODE Index, mMRC, GOLD, NEWS2, SAPS II/III, MPM

**Gastroenterology / Hepatology:**
MELD/MELD-Na, Child-Pugh, Glasgow-Blatchford, Rockall, Alvarado, MANTRELS, Ranson, BISAP, Mayo UC, Harvey-Bradshaw, CDAI

**Nephrology:**
KDIGO AKI, RIFLE, AKIN, CKD-EPI, MDRD, CKD Stages

**Oncology / Haematology:**
ECOG, Karnofsky, IPI, FLIPI, IPSS, R-IPI, TNM, PLASMIC, 4Ts

**Paediatrics:**
APGAR, PRISM III/IV, PIM 2/3, PEWS, Downes, Alvarado (paediatric), GMFCS, MACS

**Mental Health:**
PHQ-9, GAD-7, HAM-D, MADRS, PANSS, YMRS, C-SSRS, AUDIT, MMSE, MoCA

**Musculoskeletal / Rheumatology:**
Harris Hip, Oxford Hip/Knee, Constant-Murley, DAS28, CDAI/SDAI, BASDAI

**Obstetrics:**
Bishop Score, Modified Bishop

**Geriatrics / Palliative:**
Barthel Index, Katz ADL, Clinical Frailty Scale, Palliative Performance Scale, PPI

**Urology:**
IPSS/AUA-SI

**Dermatology:**
PASI, SCORAD, EASI, DLQI

**Endocrinology:**
FINDRISC

**Perioperative:**
ASA Classification, Mallampati, Aldrete

**Database additions:**
```sql
CREATE TABLE score_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  version TEXT,
  parameters JSONB NOT NULL,
  calculation_logic TEXT,
  interpretation_ranges JSONB,
  reference_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE score_calculations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id),
  encounter_id UUID REFERENCES encounters(id),
  score_definition_code TEXT NOT NULL REFERENCES score_definitions(code),
  calculated_by UUID REFERENCES profiles(id),
  parameters_input JSONB NOT NULL,
  calculated_value NUMERIC,
  calculated_at TIMESTAMPTZ DEFAULT now(),
  ai_interpretation TEXT,
  ai_confidence NUMERIC(3,2),
  ai_model_used TEXT,
  ai_guideline_citation TEXT,
  final_interpretation TEXT,
  final_severity TEXT CHECK (final_severity IN ('low','moderate','high','critical','normal')),
  overridden_by UUID REFERENCES profiles(id),
  override_reason TEXT,
  overridden_at TIMESTAMPTZ,
  is_self_assessment BOOLEAN DEFAULT false,
  shared_with_provider BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  version INTEGER DEFAULT 1
);
```

**UI — Score Calculator Widget (in encounter screen "Scoring" tab):**
- Dropdown to select score
- Radio/input fields per parameter (generated from `score_definitions.parameters`)
- Calculates in real-time as user enters values
- AI interpretation auto-fires using MedGemma 27B + UCG RAG
- Accept / Override (with mandatory reason) — all logged to audit_events
- Copy to clinical note button
- Score history chart (trend over time)

**Patient App — Self-Assessment:**
PHQ-9, GAD-7, AUDIT, FINDRISC available in app. Results stored with `is_self_assessment = true`. Patient can share with affiliated provider. AI gives patient-friendly interpretation + "Book Telemedicine" CTA.

---

### 2.2 Patient History Intelligence Engine

A new AI-powered **longitudinal patient history query system**. Clinicians can ask natural language questions about a patient's entire record across all departments and facilities.

**How it works:**
1. Clinician types query in the patient context bar: e.g., *"chest pain workup history"*
2. System embeds query using Gemini embedding API
3. Semantic vector search over `clinical_note_embeddings` (pgvector) for that patient
4. Full-text search boost (tsvector) merged with vector results
5. Assembled context sent to MedGemma 27B with UCG grounding
6. Response: structured summary + timeline + source citations + guideline anchor
7. Clinician can click any citation → navigate to original document

**New database tables:**
```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE clinical_note_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id),
  encounter_id UUID REFERENCES encounters(id),
  note_type TEXT CHECK (note_type IN (
    'soap','progress','discharge','consult','procedure',
    'lab_report','imaging_report','nursing_note','pharmacy_note'
  )),
  source_table TEXT,
  source_id UUID,
  content_text TEXT NOT NULL,
  content_tsvector TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', content_text)) STORED,
  embedding vector(1536),
  recorded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX cne_patient_idx ON clinical_note_embeddings(patient_id);
CREATE INDEX cne_embedding_idx ON clinical_note_embeddings USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX cne_tsvector_idx ON clinical_note_embeddings USING GIN (content_tsvector);

CREATE TABLE patient_history_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  queried_by UUID NOT NULL REFERENCES profiles(id),
  query_text TEXT NOT NULL,
  query_embedding vector(1536),
  filters JSONB,
  ai_summary TEXT,
  ai_model_used TEXT,
  guideline_citations TEXT[],
  source_count INTEGER,
  generated_at TIMESTAMPTZ DEFAULT now(),
  is_starred BOOLEAN DEFAULT false
);
```

**Ingestion pipeline:** Every new clinical note, lab result, imaging report, and nursing note triggers an Edge Function that generates an embedding and stores it in `clinical_note_embeddings`. This runs asynchronously — never blocks the clinical workflow.

**UI — History Intelligence Panel:**
- Search bar in patient context column (Column 1 of encounter screen)
- Opens as right slide-over panel
- Shows: AI summary (300 words max) → chronological timeline → source list (clickable)
- "Copy to current note" button
- "Star query" button (save for frequent queries)
- Available in patient app with patient-friendly language: *"What did my last blood tests show?"*

**API:**
```
POST /api/patient-history/summarize
GET  /api/patient-history/queries        → saved/starred queries for this patient
```

---

### 2.3 Lab Automation Pipeline (Instrument-to-Patient)

Complete **automated lab result delivery** from physical lab instrument to patient's mobile app — no manual steps after the lab technician authorises.

**Architecture:**
```
Lab Instrument (ASTM/HL7)
    → Lab Bridge Service (local Node.js/Python on lab PC)
    → POST /api/lab/instrument-ingest (API key auth)
    → Supabase lab_results table
    → Database trigger → Edge Function: notify-patient-lab
    → Expo Push Notification → Patient App
    → FHIR API fetch → Result displayed with AI interpretation
```

**Lab Bridge Service** runs on a local Raspberry Pi or PC in the lab. Configured once via Admin → Lab → Instruments. Communicates with analyser via RS-232 serial or TCP/IP. Translates ASTM/HL7 → SynapseOS JSON.

**New table:**
```sql
CREATE TABLE lab_instrument_bridges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  instrument_type TEXT,
  connection_type TEXT CHECK (connection_type IN ('serial','tcp','file','hl7_mllp')),
  connection_config JSONB,
  api_key TEXT UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Critical rule:** Results are NOT released to patient app until `status = 'final'` AND `verified_at IS NOT NULL`. Lab supervisor verification is mandatory.

**Auto-release configuration:** Admin configures which test types auto-release vs. require provider review (e.g., CBC auto-releases; HIV PCR requires doctor to review first).

**Patient app result screen:**
- Value + unit + reference range
- Colour indicator (normal / low / high / critical)
- Trend sparkline (last 5 results for same LOINC)
- AI interpretation in plain language
- "Share with Care Team" button
- Cached for offline viewing

---

### 2.4 Cross-Facility Information Exchange

When a referral is initiated, the system builds a **FHIR Bundle** and transfers it securely to the receiving facility.

**What transfers:**
- Patient demographics (always)
- Allergies + blood group (always — safety critical)
- Current diagnosis + ICD-11 code
- Medications list
- Relevant lab results (sending doctor selects which)
- Relevant imaging (sending doctor selects which)
- Clinical summary (AI-drafted, doctor edits)

**What never transfers:** Full psychiatric records (require separate explicit consent), HIV status (PMTCT records only with specific consent), financial data.

**Flow:**
1. Doctor clicks "Refer" in encounter → selects target facility from registered SynapseOS network
2. Selects data to share → system builds FHIR Bundle
3. Patient signs consent (on screen or by SMS OTP)
4. Bundle sent to receiving facility via secure API
5. Receiving facility notified → reviews → accepts/declines
6. On acceptance: patient arrives → temporary cross-tenant read access granted
7. Original records remain at sending facility (data sovereignty)

---

## SECTION 3: COMPLETE FEATURE MAP (Everything, Consolidated)

### Synapse OS — Facility Features

```
CLINICAL DEPARTMENTS (each with full workspace + AI assistant)
├── OPD / General Medicine
├── Accident & Emergency (A&E)
│   ├── Triage board (ESI scoring, AI-assisted)
│   ├── Resuscitation record (timestamp mode)
│   └── Major incident protocol (START algorithm)
├── Maternity & Obstetrics
│   ├── ANC tracker (WHO protocol, risk stratification)
│   ├── Digital partograph (WHO, AI flag deviations)
│   ├── Delivery record
│   ├── Newborn assessment (APGAR, immediate care)
│   ├── PMTCT (HIV+ mothers)
│   └── MPDSR (maternal death surveillance)
├── Paediatrics
│   ├── Growth charts (WHO Z-scores, real-time)
│   ├── Developmental milestones
│   ├── Immunisation scheduler + reminders
│   ├── Weight-based drug dosing (auto-calculated)
│   └── CMAM (malnutrition management)
├── HIV / ART Clinic
│   ├── Enrolment + ART number
│   ├── Regimen management (1st/2nd/3rd line)
│   ├── Viral load tracking + suppression monitoring
│   ├── Adherence counselling records
│   ├── Drug interaction checker (rifampicin + ART)
│   └── PMTCT mother-infant linkage
├── Surgery & Theatre
│   ├── Theatre scheduling
│   ├── WHO Surgical Safety Checklist (3 time-points)
│   ├── Anaesthesia record
│   ├── Intraoperative record
│   └── Post-op recovery (Aldrete scoring)
├── Cardiology
│   ├── ECG upload + AI interpretation (rhythm, STEMI)
│   ├── Risk scores (TIMI, GRACE, CHA₂DS₂-VASc, HEART)
│   ├── Echo reports
│   └── Cath lab activation (one-click for STEMI)
├── Intensive Care Unit (ICU)
│   ├── Hourly flowsheets (haemodynamic + ventilator)
│   ├── SOFA + APACHE II scoring
│   ├── Sepsis bundle tracker (Hour-1 bundle)
│   └── Fluid balance chart
├── Mental Health / Psychiatry
│   ├── PHQ-9, GAD-7, PANSS, C-SSRS, MMSE, MoCA
│   ├── Structured risk assessment
│   ├── Safety plan documentation
│   ├── Crisis contact management
│   └── Extra RLS privacy (only MH staff can access)
├── Oncology
│   ├── TNM staging
│   ├── Chemotherapy protocol library (BSA dosing)
│   ├── CTCAE toxicity grading
│   └── Palliative care integration (ESAS)
├── Nephrology / Dialysis
│   ├── Dialysis session records
│   ├── eGFR trending (CKD-EPI)
│   └── CKD staging
├── Care Home / Long-term Care
│   ├── Person-centred care plans
│   ├── Daily care records
│   ├── Barthel Index, Waterlow, MUST, Falls Risk
│   └── Activity and nutrition records
├── Community Health
│   ├── CHW mobile app (offline-capable)
│   ├── Catchment area mapping (Mapbox)
│   ├── Household surveys
│   ├── MUAC screening
│   └── Contact tracing
└── Teaching Hospital
    ├── Ward round mode (AI pre-round summary)
    ├── Teaching notes per patient
    ├── Student tracking
    └── M&M conference records

CROSS-CUTTING OS FEATURES
├── AI Clinical Workspace (persistent right-rail panel)
│   ├── Differential diagnosis (MedGemma 27B + UCG RAG)
│   ├── Investigation recommendations (LOINC-coded)
│   ├── Lab result interpretation (auto-fires on result authorisation)
│   ├── Management plan (UCG-grounded)
│   ├── SOAP note generation (MedGemma)
│   ├── Discharge instructions (multilingual, Gemini)
│   ├── Insurance coverage check (inline, every order)
│   └── Clara Reason XAI (explain every decision)
├── Clinical Scoring Module (150+ scores)
│   ├── Pre-loaded score definitions
│   ├── AI interpretation (MedGemma + UCG)
│   ├── Override with mandatory reason
│   ├── Score trends over time
│   └── Critical score → automatic alert to care team
├── Patient History Intelligence Engine
│   ├── Natural language query over entire history
│   ├── Vector search (pgvector) + full-text search
│   ├── Timeline with source citations
│   └── Cross-facility history (if consented)
├── Laboratory Information System (LIS)
│   ├── Orders queue (STAT/Urgent/Routine)
│   ├── Specimen collection + barcode printing
│   ├── Lab instrument bridge (ASTM/HL7 → JSON)
│   ├── Supabase Realtime → doctor UI
│   ├── Edge Function → patient app push notification
│   ├── AI result interpretation
│   └── QC charts (Levey-Jennings, Westgard rules)
├── Pharmacy
│   ├── Prescription queue (real-time)
│   ├── 5-step dispense flow with barcode scanning
│   ├── FEFO batch enforcement
│   ├── Drug interaction checker (OpenFDA + MedGemma)
│   └── NMS requisition auto-generation
├── Radiology
│   ├── DICOM viewer (Cornerstone.js)
│   ├── AI preliminary read (Gemini Vision)
│   └── Critical finding alert (immediate notification)
├── Device Integration
│   ├── RuView WiFi sensing (fall, breathing, presence)
│   ├── Consumer wearables (HealthKit/Google Fit)
│   ├── Clinical monitors (OpenICE/HL7)
│   ├── Three-tier anomaly detection
│   └── Emergency notification chain (in-app + SMS + WhatsApp)
├── Telemedicine
│   ├── Guided chatbot intake (13-step state machine)
│   ├── LiveKit video + Whisper transcription
│   ├── AI SOAP note post-call
│   └── Independent professional portal
├── Insurance Copilot
│   ├── Real-time coverage check (every order)
│   ├── Pre-auth automation
│   ├── Claim auto-submission (on encounter sign)
│   └── AI appeal letters (Gemini Pro + UCG)
├── SDG Command Center
│   ├── All 17 goals calculated nightly
│   ├── RadialBarChart dashboard
│   ├── GRI-compliant PDF report
│   └── UN CSV export
├── Epidemiology & Surveillance
│   ├── Disease incidence trends (ICD-11)
│   ├── Geographic choropleth (Mapbox)
│   ├── Death sentinel (cron every 6h)
│   ├── Notifiable disease auto-reporting
│   ├── DHIS2 nightly export
│   └── Climate overlay (OpenWeather)
├── Outbreak Alert System
│   ├── Sentinel logic (deaths, incidence spikes, spatial clustering)
│   ├── Platform admin review + approval
│   ├── Scoped broadcast (facility/district/national/global)
│   └── Push notification to all App users in scope
├── Inter-Facility Referrals
│   ├── FHIR Bundle construction
│   ├── Patient consent capture (screen or SMS OTP)
│   ├── Receiving facility notification + acceptance
│   └── Temporary cross-tenant record access
├── Peer Professional Consultation
│   ├── Speciality matching
│   ├── Async text / chat / video (LiveKit)
│   ├── De-identified for cross-tenant
│   └── Documented in encounter record
├── Encrypted Communications
│   ├── E2E encrypted chat (Signal Protocol)
│   ├── Voice calls (WebRTC encrypted)
│   ├── Video calls (LiveKit encrypted)
│   └── All message types: text, voice note, image, document
├── International Medical ID (IMID)
│   ├── QR code (FHIR IPS, time-limited URL)
│   ├── NFC tap option
│   ├── Patient-controlled consent settings
│   └── Full access log visible to patient
├── Billing & Revenue Cycle
│   ├── AI-generated itemised bill (ICD-11 → tariff)
│   ├── Insurance portion vs. patient portion
│   ├── MTN Mobile Money + Airtel Money
│   └── Revenue analytics dashboard
├── HR & Scheduling
│   ├── Staff management (invite, roles, departments)
│   ├── Shift roster + conflict detection
│   ├── Attendance + leave management
│   └── Payroll calculation
└── Supply Chain
    ├── AI demand forecasting (30-day stockout prediction)
    ├── Purchase order workflow
    ├── Supplier performance tracking
    └── NMS integration
```

### Synapse App — Consumer Features

```
PERSONAL HEALTH
├── Health dashboard (vitals, conditions, medications)
├── Medical records (synced from any affiliated OS facility)
├── Lab results (push notification → view with AI explanation)
├── Prescription history
├── Allergy record
└── International Medical ID (QR, NFC, shareable link)

CHILDREN & MOTHERS
├── Child profiles (register multiple children)
├── WHO growth charts (weight-for-age, height-for-age, MUAC)
├── Nutritional status classification + AI tips
├── Immunisation schedule (country-specific, auto-generated)
├── Immunisation records (clinic-synced + manual)
├── Reminders (7 days before, day of, overdue follow-up)
└── ANC schedule + danger signs guide

DEVICES & MONITORING
├── Apple Watch / Fitbit / Garmin / Samsung Health
├── HealthKit (iOS) / Google Fit (Android) integration
├── Real-time vitals sync (every 15 min background)
├── Threshold alerts (HR, SpO₂, BP, glucose)
├── Alert → user + affiliated facility + emergency contact
└── Chronic disease logs (BP diary, glucose diary, peak flow)

TELEMEDICINE
├── Guided symptom chatbot (13 steps, no free text)
├── Triage classification (Emergency / Urgent / Routine)
├── Book appointment (available doctors, time slots)
├── LiveKit video consultation
├── Post-call: prescription + instructions + follow-up
└── Independent doctor finder (apply-professional flow)

INSURANCE
├── Insurance wallet (store multiple cards)
├── Admission sync (one-tap → send to hospital)
├── Discharge sync (receive bill + claim status)
└── Claim status tracking

MEDICATIONS
├── Medication schedule (from prescription or manual)
├── Daily reminders at prescribed times
├── Adherence tracking ("Did you take it?")
├── Refill reminder (3 days before estimated end)
└── Drug information (dose, side effects, interactions)

AI HEALTH ADVICE
├── Symptom checker (grounded in country guidelines)
├── "When to seek care" guidance
├── Nutrition knowledge (pregnancy, diabetes, infant feeding)
├── Food-drug interactions
└── Always says: "This is not a diagnosis. See a provider."

SELF-ASSESSMENTS
├── PHQ-9 (depression)
├── GAD-7 (anxiety)
├── AUDIT (alcohol)
├── FINDRISC (diabetes risk)
└── Share results with affiliated provider

PUBLIC HEALTH
├── District disease burden (admin-approved only)
├── Active outbreak alerts (geo-filtered, push notification)
├── Seasonal disease calendar
└── Vaccination campaign alerts

COMMUNICATIONS
├── Encrypted chat with care team
├── Voice messages
├── Video calls (LiveKit)
└── File sharing (lab results, prescriptions)

EMERGENCY
├── Emergency SOS (hold 3 seconds)
├── Calls country emergency number
├── Sends GPS + Medical ID to emergency contacts
├── Alerts affiliated facility
└── Shows nearest SynapseOS facility on map
```

---

## SECTION 4: COMPLETE ROUTE MAP (No Dead Links)

### Synapse OS Routes

```
PUBLIC (synapseos.health)
/ → Landing page
/features → Features overview
/sdg → SDG showcase
/pricing → Pricing tiers
/demo → Interactive demo (role selector)
/demo/doctor → Doctor dashboard (mock data)
/demo/nurse → Nurse ward view (mock data)
/demo/pharmacy → Pharmacist view (mock data)
/demo/admin → Admin overview (mock data)
/demo/patient → Patient portal (mock data)
/telemedicine → Guided chatbot intake (public)
/apply-pro → Facility pilot application
/apply-pro/thank-you → Confirmation page
/apply-professional → Independent doctor application
/blog → Blog listing
/blog/[slug] → Blog post
/about → About page
/contact → Contact form
/changelog → Product changelog
/legal/privacy → Privacy Policy
/legal/terms → Terms of Service
/legal/dpa → Data Processing Agreement
/legal/cookie-policy → Cookie Policy
/legal/accessibility → Accessibility Statement
/legal/consent-withdrawal → Consent withdrawal guide
/404-tenant → Branded unknown subdomain page
/maintenance → Per-tenant maintenance page

AUTH ([slug].synapseos.health/auth OR app.synapseos.health/auth)
/login → Email + password, magic link
/signup → Patient signup only
/forgot-password → Email reset
/reset-password → New password form
/verify-email → Verification pending
/invite/[token] → Staff invitation acceptance
/unauthorized → Access denied

DOCTOR WORKSPACE (/doctor/*)
/doctor/queue → Patient queue (real-time)
/doctor/schedule → My schedule + calendar
/doctor/tele → Telemedicine appointments
/doctor/rounds → Ward round mode (teaching hospital)
/doctor/notes → Clinical notes history
/doctor/orders → Orders management
/doctor/ai → AI diagnosis tool (standalone)
/doctor/consults → Peer consultations
/doctor/referrals → Referrals sent/received
/doctor/reports → Analytics

ENCOUNTER (/encounter/*)
/encounter/[id] → Full 3-column encounter screen
/encounter/[id]/history → Patient History Intelligence
/encounter/[id]/scoring → Clinical scoring tab
/encounter/[id]/sign → Signature tab
/encounter/new → New encounter creation

NURSE (/nurse/*)
/nurse/ward → Ward bed grid overview
/nurse/vitals → Vitals due list
/nurse/mar → Medication Administration Record
/nurse/beds → Bed management
/nurse/handover → Shift handover (SBAR)
/nurse/observations → Patient observations log
/nurse/procedures → Procedures checklist

LAB (/lab/*)
/lab/orders → Orders queue
/lab/specimens → Specimen collection
/lab/results → Results entry
/lab/verify → Supervisor verification queue
/lab/qc → Quality control charts
/lab/instruments → Lab bridge configuration
/lab/reports → Lab analytics

PHARMACY (/pharmacy/*)
/pharmacy/queue → Prescription queue
/pharmacy/dispense → Dispense flow
/pharmacy/inventory → Stock management
/pharmacy/expiry → Expiry alerts (FEFO)
/pharmacy/nms → NMS requisitions
/pharmacy/drug-info → Drug reference
/pharmacy/interactions → Interaction checker
/pharmacy/reports → Pharmacy analytics

RADIOLOGY (/radiology/*)
/radiology/orders → Imaging orders queue
/radiology/results → Results + DICOM viewer
/radiology/reports → Radiology reports

ADMIN (/admin/*)
/admin/overview → Hospital admin dashboard
/admin/staff → Staff management
/admin/invite → Invite staff
/admin/beds → Bed and ward management
/admin/departments → Department configuration
/admin/finance → Revenue analytics
/admin/finance/invoices → Invoice list
/admin/finance/payments → Payment records
/admin/insurance → Insurance configuration
/admin/insurance/claims → Claims management
/admin/insurance/appeals → Appeal drafts
/admin/supply → Supply chain
/admin/supply/orders → Purchase orders
/admin/hr → HR management
/admin/hr/schedules → Staff scheduling
/admin/hr/attendance → Attendance records
/admin/hr/payroll → Payroll
/admin/audit → Audit log viewer
/admin/settings → Facility settings
/admin/settings/domain → Custom domain setup
/admin/settings/branding → Branding config
/admin/settings/guidelines → Clinical guidelines upload
/admin/lab → Lab instrument configuration

DEPARTMENTS (/dept/*)
/dept/maternity/anc → ANC clinic
/dept/maternity/labour → Labour & delivery
/dept/maternity/postnatal → Postnatal care
/dept/paediatrics/queue → Paediatric OPD
/dept/paediatrics/growth → Growth chart entry
/dept/paediatrics/immunisation → Immunisation records
/dept/hiv/dashboard → HIV clinic dashboard
/dept/hiv/enrolments → Client enrolments
/dept/hiv/art → ART regimen management
/dept/hiv/vl → Viral load tracker
/dept/ae/triage → A&E triage board
/dept/ae/resus → Resuscitation record
/dept/theatre/schedule → Theatre schedule
/dept/theatre/checklist → WHO SSC
/dept/icu/dashboard → ICU overview
/dept/icu/flowsheet → Hourly flowsheet
/dept/icu/scoring → SOFA/APACHE scoring
/dept/cardiology/ecg → ECG upload + AI
/dept/cardiology/scores → Cardiac risk scores
/dept/mental/assessments → Psychiatric assessments
/dept/mental/risk → Risk assessment
/dept/oncology/staging → TNM staging
/dept/oncology/chemo → Chemotherapy cycles
/dept/dialysis/sessions → Dialysis records
/dept/carepath/plans → Care plans (care home)
/dept/community/chw → CHW management
/dept/community/map → Catchment area map

SDG & PUBLIC HEALTH (/sdg/*, /epidemiology/*)
/sdg/dashboard → SDG Command Center
/sdg/goal/[number] → Individual goal drill-down
/sdg/reports → Report generation
/epidemiology → Epidemiology dashboard
/epidemiology/alerts → Outbreak alerts management
/epidemiology/outbreaks → Active outbreaks
/epidemiology/dhis2 → DHIS2 export status

PATIENT PORTAL (/patient/*)
/patient/dashboard → Patient home
/patient/appointments → Appointments list
/patient/records → Health records
/patient/labs → Lab results
/patient/meds → Medications
/patient/immunisation → Immunisation card
/patient/bills → Bills + pay
/patient/messages → Clinical messages
/patient/devices → Device management
/patient/medical-id → IMID view + share
/patient/consent → Consent management

FHIR API (/fhir/*)
/fhir/metadata → CapabilityStatement
/fhir/Patient/[id]
/fhir/Observation?patient=[id]
/fhir/Condition?patient=[id]
/fhir/MedicationRequest?patient=[id]
/fhir/DiagnosticReport?patient=[id]
/fhir/Immunization?patient=[id]
/fhir/Encounter?patient=[id]
/fhir/AllergyIntolerance?patient=[id]
/fhir/Bundle (POST)

IMID PUBLIC
/imid/[code] → FHIR IPS document (token-gated)

PLATFORM ADMIN (admin.synapseos.health/*)
/ → Overview
/applications → Pilot applications
/tenants → All tenants
/tenants/[id] → Tenant detail
/tenants/provision → Provision new
/system/health → System health
/system/settings → Global settings
/guidelines → Upload clinical guidelines
/broadcasts → Outbreak alert management
/feature-flags → Per-tenant feature flags
/billing → Subscription management
/users → All users
```

### Synapse App Routes (Expo Router)

```
/(tabs)/index → Home dashboard
/(tabs)/records → Health records
/(tabs)/telemedicine → Telemedicine hub
/(tabs)/devices → Device management
/(tabs)/profile → User profile

/auth/login → Login
/auth/signup → Sign up
/auth/verify → Verify email

/telemedicine/chatbot → Symptom checker
/telemedicine/room/[id] → Video call
/telemedicine/booking/[doctorId] → Appointment booking
/telemedicine/booked/[id] → Confirmation + countdown

/records/labs → Lab results list
/records/labs/[id] → Lab result detail + AI + trend
/records/visits/[id] → Visit summary
/records/prescriptions → Prescription history

/children → Children list
/children/add → Register child
/children/[id] → Child health record
/children/[id]/growth → Growth chart
/children/[id]/immunisation → Immunisation card

/devices/connect → Add device
/devices/[id] → Device detail + vitals
/devices/affiliations → Facility affiliations

/insurance → Insurance wallet
/insurance/add → Add insurance
/insurance/[id] → Insurance card detail

/medications → Medication schedule
/medications/[id] → Medication detail + log
/medications/log/[scheduleId] → Log dose taken/missed

/assessments → Self-assessment tools
/assessments/phq9 → PHQ-9
/assessments/gad7 → GAD-7
/assessments/audit → AUDIT
/assessments/findrisc → FINDRISC

/public-health → Public health dashboard
/public-health/outbreaks → Active outbreaks
/public-health/district → District data

/medical-id → IMID home
/medical-id/qr → QR code display
/medical-id/access-log → Access history
/medical-id/settings → Consent settings

/messages → Conversations list
/messages/[id] → Conversation
/messages/new → New conversation

/emergency → SOS screen

/profile/settings → Account settings
/profile/consent → Consent management
/profile/language → Language settings
/profile/notifications → Notification preferences
```

---

## SECTION 5: DESIGN SYSTEM (Canonical Reference)

```css
:root {
  /* Brand */
  --synapse-950: #060D1A;
  --synapse-900: #0B1628;
  --synapse-800: #112040;
  --synapse-700: #1A3060;
  --synapse-600: #1E3A8A;
  --teal-500:    #00D4AA;
  --teal-400:    #00E5B8;
  --sky-500:     #0EA5E9;
  --sky-400:     #38BDF8;

  /* Acuity */
  --acuity-red:    #EF4444;
  --acuity-orange: #F97316;
  --acuity-yellow: #EAB308;
  --acuity-green:  #22C55E;
  --acuity-black:  #374151;

  /* AI Confidence */
  --conf-high:   #22C55E;  /* ≥85% */
  --conf-med:    #EAB308;  /* 60-84% */
  --conf-low:    #EF4444;  /* <60% */

  /* Typography */
  --font-display: 'Syne', sans-serif;          /* Headers, brand */
  --font-body:    'IBM Plex Sans', sans-serif; /* Clinical content */
  --font-mono:    'JetBrains Mono', monospace; /* Codes, MRNs, vitals */
  --font-clinical:'Source Serif 4', serif;     /* Notes, SOAP */
}
```

---

## SECTION 6: WHAT CLAUDE CODE BUILDS VS. WHAT YOU VALIDATE

### Claude Code builds (~80%):
All infrastructure, scaffolding, UI components, API routes, database migrations, RLS policies, AI integrations, device ingestion, score calculators, history intelligence pipeline, lab bridge, notification chains, legal page renders, documentation site, CI/CD.

### You validate (~20% — the most important part):
- Clinical score formula correctness (verify every formula against published source)
- AI diagnosis outputs for common presentations (compare to UCG)
- Drug interaction checker coverage (test edge cases)
- RLS boundary testing (verify cross-tenant isolation manually)
- UX in clinical context (time every flow, test on a busy nurse)
- Legal document review (qualified Ugandan lawyer before signing anything)
- Regulatory submission (Uganda MoH / PDPO engagement)

---

## SECTION 7: THE BEACHHEAD (What to Build First)

Despite the full spec, build in this order:

**Week 1-2:** Foundation (monorepo, DB, auth, security, middleware)
**Week 3-4:** AI Clinical Workspace + Doctor encounter screen + Lab pipeline
**Week 5-6:** Nurse dashboard + Pharmacy + Admin setup wizard
**Week 7:** Maternity + Paediatrics + Immunisation (highest disease burden)
**Week 8:** HIV clinic + A&E (Uganda-specific priority)
**Week 9:** Clinical Scoring Module + History Intelligence Engine
**Week 10:** Device integration + Anomaly detection + App MVP
**Week 11:** SDG + Epidemiology + Outbreak alerts
**Week 12:** Insurance Copilot + Billing + Polish
**Week 13:** Landing page + Legal pages + Demo mode
**Week 14:** CI/CD + Lighthouse audit + Pilot deployment

---

*Synapse Ecosystem v9.0 — Every life deserves intelligence at its side.*
