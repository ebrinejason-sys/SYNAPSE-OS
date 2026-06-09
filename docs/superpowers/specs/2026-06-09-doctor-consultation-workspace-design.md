# Doctor Consultation Workspace — Design Spec
**Date:** 2026-06-09  
**Author:** Ebrine Jason / Claude  
**Status:** Approved  
**Sub-project:** 1 of 5 (see decomposition below)

---

## Context

SynapseOS already has a large codebase with a working pharmacy app, platform admin, hospital admin, and patient portal. The critical gap is the **doctor clinical encounter interface** — the core product hospitals pay for. All required Supabase tables already exist (`encounters`, `encounter_diagnoses`, `encounter_orders`, `hospital_drug_orders`, `vitals`, `patients`, `profiles`). The current pages at `/consults/new` and `/consults/[id]` are 8-line stubs.

---

## Overall Platform Decomposition (5 sub-projects)

| # | Sub-project | Status |
|---|---|---|
| **1** | Doctor Consultation Workspace | **This spec** |
| 2 | Missing DB migrations (facility_subscriptions, feature_flags, support_tickets, wearable_devices, pharmacy_network_inventory, insurance_schemes, patient_insurance_cards, dhis2_export_log, medical_passports) | Next |
| 3 | SynapseEPI Surveillance Dashboard (/platform/public-health) | Queued |
| 4 | Top 10 Department Dashboards (OPD, A&E, Lab, Pharmacy, Maternity, Wards + 4 others) | Queued |
| 5 | Platform Revenue Intelligence + Admin completions (billing, DHIS2, impersonation) | Queued |

---

## Sub-project 1: Doctor Consultation Workspace

### Goal

Build a complete, production-grade clinical encounter interface that a doctor in Uganda can use to:
- Open/create a patient encounter
- Record history, examination, vitals
- Get AI-assisted differential diagnoses and investigation suggestions
- Order lab tests and radiology
- Write and dispense prescriptions
- Submit SOAP notes and finalize the encounter

---

## Routes

```
/consults                    — Doctor's encounter queue/list (existing, needs content)
/consults/new                — New encounter creation flow
/consults/[id]               — Full encounter workspace (primary deliverable)
/consults/[id]/call          — LiveKit room (already exists, do not touch)
```

---

## Architecture

### Page Structure

`/consults/[id]/page.tsx` is a **server component** that:
1. Fetches the encounter + patient data server-side (using Supabase server client)
2. Passes hydrated data to a client component `<ConsultationWorkspace />`
3. Auth-guards: only the assigned doctor or hospital_admin can open the encounter

`/consults/new/page.tsx` is a client component with a two-step flow:
1. Patient search (search `patients` table by name/NIN/patient_id)
2. Encounter type selector (OPD, Emergency, Follow-up, Telemedicine) → POST to create encounter → redirect to `/consults/[id]`

### Layout: Split-Panel Desktop, Stack Mobile

```
┌─────────────────────────────────────────────────────────┐
│  HEADER: Patient name + DOB + Synapse ID | Encounter type | Status chip | ⊕ Submit  │
├──────────────┬──────────────────────────────────────────┤
│ LEFT PANEL   │  RIGHT PANEL (scrollable sections)       │
│ (320px fixed)│                                           │
│              │  1. Presenting Complaint + HPC            │
│  Patient     │  2. Examination + Vitals                  │
│  Context     │  3. AI Clinical Assistant                 │
│  Card        │  4. Diagnosis (ICD-11)                    │
│              │  5. Management Plan (Inv / Rx / Referral) │
│  - Allergies │  6. Clinical Notes (SOAP)                 │
│  - Active Rx │  7. Follow-up                             │
│  - Vitals    │                                           │
│  - Dx list   │                                           │
│  - Prev      │                                           │
│    encounters│                                           │
└──────────────┴──────────────────────────────────────────┘
```

On mobile (<768px): left panel collapses to a top summary strip; sections stack vertically.

---

## Left Panel — Patient Context Card

**Data source:** `patients` JOIN `profiles`, `patient_allergies`, `hospital_drug_orders` (active), `vitals` (last 5), `encounter_diagnoses` (active problems), `encounters` (last 3)

**Sections:**
- **Allergy banner** — red alert bar if any allergies exist. Lists allergen names.
- **Demographics chip strip** — Age, Sex, Blood type (if known), NIN (masked)
- **Active medications** — list from `hospital_drug_orders` where `status = 'active'`
- **Recent vitals** — last reading for BP, Temp, SpO2, Pulse, Weight with delta arrow vs previous
- **Active problems** — from `encounter_diagnoses` where `is_active = true`
- **Previous encounters** — last 3 with date, type, and chief complaint; click opens in new tab

---

## Right Panel — Encounter Sections

Auto-saves state to `encounters.draft_data` (JSONB column) every 30 seconds on change. Draft is restored on page load if encounter status is `draft`.

### Section 1: Presenting Complaint + History

Fields:
- **Chief complaint** (textarea, required) — freeform
- **Duration** (number + unit dropdown: hours/days/weeks/months)
- **HPC** (textarea) — History of Presenting Complaint
- **Systems review** (checkbox grid, 2-col):
  - Constitutional: Fever, Weight loss, Fatigue, Night sweats
  - Respiratory: Cough, Dyspnoea, Haemoptysis, Wheeze
  - CVS: Chest pain, Palpitations, Oedema, Syncope
  - GI: Nausea, Vomiting, Diarrhoea, Abdominal pain, Bleeding PR
  - GU: Dysuria, Frequency, Haematuria, Discharge
  - MSK: Joint pain, Swelling, Limitation of movement
  - Neuro: Headache, Dizziness, Seizures, Weakness, Numbness
  - Psychiatric: Mood change, Anxiety, Sleep disturbance, Hallucinations
- **PMH** (textarea) — Past Medical History
- **Surgical history** (textarea)
- **Family history** (textarea)
- **Social history** (textarea) — Occupation, Alcohol, Tobacco, Other substances

### Section 2: Examination + Vitals

**Vitals entry sub-form** (pre-populated from nursing entry if available):
| Field | Unit | Validation |
|---|---|---|
| Temperature | °C | 30–43 |
| Pulse | bpm | 20–250 |
| Respiratory rate | /min | 5–60 |
| Blood pressure (systolic/diastolic) | mmHg | 50–300 / 20–200 |
| SpO2 | % | 50–100 |
| Weight | kg | 0.5–500 |
| Height | cm | 20–250 |
| RBS | mmol/L | 1–50 |
| MUAC | cm | optional, paediatric |

Auto-calculates BMI if weight + height entered.

**Systemic examination** — one expandable card per system (same list as systems review). Free text field per system with a "Normal" quick-fill button that inserts standard normal findings text.

**GCS widget** (for Emergency type encounters) — 3 dropdowns (Eye 1-4, Verbal 1-5, Motor 1-6) + total score display, colour-coded.

### Section 3: AI Clinical Assistant

Displayed as a collapsible right-side drawer on desktop, bottom sheet on mobile.

**Trigger:** Auto-fires when the user pauses typing in the Chief Complaint field (800ms debounce) AND when the Diagnosis search field is used.

**Gemini prompt context injected:**
- Patient age, sex
- Chief complaint + HPC text
- Active medications list (for interaction checking)
- Known allergies
- Systems review positives
- Current hospital district (from `hospitals.district`)
- Current month (for seasonal disease prevalence)
- Uganda-specific context: "Patient is in Uganda. Prioritise endemic conditions: malaria, tuberculosis, typhoid, HIV, sickle cell."

**Response format (streamed via SSE):**

```json
{
  "differentials": [
    { "name": "Plasmodium falciparum malaria", "icd11": "1F40", "probability": "high", "rationale": "Fever + East Africa + rainy season" },
    ...
  ],
  "investigations": [
    { "test": "Malaria RDT", "urgency": "stat", "rationale": "Confirm diagnosis" },
    ...
  ],
  "drug_alerts": [],
  "guideline_snippet": "UCG 2023: Uncomplicated malaria — artemether-lumefantrine 20/120mg..."
}
```

**UI:** Orange-bordered card. Differentials shown as ranked chips with ICD-11 code. Clicking a differential pre-fills the diagnosis search. Investigations shown as "Order" buttons that pre-fill the orders section.

**API route:** `GET /api/consults/[id]/ai?complaint=...&context=...` — streams Gemini response.

### Section 4: Diagnosis

Uses **ICD-11 search** — calls WHO ICD-11 linearization API (`icd.who.int/icdapi`) for real-time search. Falls back to local `diagnoses` table if offline.

Fields per diagnosis row:
- ICD-11 code + name (searchable)
- Type: Primary | Secondary | Differential | Rule-out
- Certainty: Confirmed | Suspected | Working
- Remove button

Saves to `encounter_diagnoses` table on each add/remove (not just on submit).

### Section 5: Management Plan

Three sub-tabs:

**5a. Investigations**

Two sections: Laboratory and Radiology.

Lab order form:
- Test category (dropdown: Haematology, Chemistry, Microbiology, Serology, Urinalysis, Malaria, COVID-19, Other)
- Specific test (populated from `service_catalog` filtered by category + hospital)
- Urgency: Routine | Urgent | STAT
- Clinical notes for lab (optional)

Saves to `encounter_orders` with `order_type = 'lab'`.

Radiology order form:
- Modality: X-ray | Ultrasound | CT | MRI | Fluoroscopy | Other
- Body region (text input)
- Clinical indication (textarea)
- Urgency

Saves to `encounter_orders` with `order_type = 'radiology'`.

**5b. Medications (Prescription Builder)**

Drug search: searches `inventory_items` (hospital formulary first) then falls back to free text. Shows generic name first, brand in parentheses.

Per drug row:
- Drug name (searchable)
- Dose (number + unit: mg/mcg/g/ml/units)
- Route: Oral | IV | IM | SC | Topical | Inhaled | Other
- Frequency: OD | BD | TDS | QID | Nocte | PRN | Stat | Custom
- Duration (number + days/weeks)
- Patient instructions (textarea, auto-populated from template)
- Drug interaction check: fires against `drug_interactions_catalog` + Gemini on add

Saves to `hospital_drug_orders`.

Controlled drug flag: if drug is in controlled list, shows yellow warning and requires dual note.

**5c. Procedures + Referrals**

Procedures: free text textarea with template buttons (Wound dressing, IV cannulation, Catheterisation, Incision & drainage, etc.)

Referral form:
- Type: Internal (to department) | External (to facility)
- Department/Facility (dropdown / text)
- Urgency: Routine | Urgent | Emergency
- Reason (textarea)
- Creates row in `referral_requests`

### Section 6: Clinical Notes

Toggle between:
- **SOAP format**: 4 textareas (Subjective, Objective, Assessment, Plan) — pre-populated from other sections where possible (Objective auto-fills from vitals)
- **Free text**: single textarea for narrative notes

Auto-saves to `encounters.clinical_notes` (JSONB) every 30s with debounce.

### Section 7: Follow-up

- **Follow-up needed?** (Yes/No toggle)
- **Date** (date picker — min: tomorrow, max: +1 year)
- **Interval** (quick-select: 1 week / 2 weeks / 1 month / 3 months / Custom)
- **Instructions to patient** (textarea, max 500 chars — this becomes the SMS body)
- **Appointment type** for follow-up: OPD | Telemedicine | Phone

---

## Encounter Submission

**Submit button** in the sticky header. Validates:
1. Chief complaint not empty
2. At least one diagnosis added
3. Clinical notes not empty

On submit:
1. Update `encounters.status = 'completed'`, `encounters.completed_at = now()`
2. Save all draft sections atomically in a Supabase transaction
3. If follow-up: insert row into `telemedicine_appointments` or appointment table
4. Send Africa's Talking SMS to patient: "Dear [Name], your consultation at [Facility] on [date] is complete. [Follow-up instructions]. Ref: [encounter_id]"
5. Create `audit_log` entry
6. Redirect to `/consults` with success toast

**Draft auto-save:** Every 30s, PATCH `encounters.draft_data` with current form state. On load, if `encounters.status = 'draft'`, restore from `draft_data`.

---

## API Routes

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/consults/[id]` | Full encounter + patient context |
| POST | `/api/consults/new` | Create encounter, return new `id` |
| PATCH | `/api/consults/[id]/draft` | Auto-save draft state |
| POST | `/api/consults/[id]/vitals` | Save vitals to `vitals` table |
| POST | `/api/consults/[id]/dx` | Add/remove diagnosis |
| POST | `/api/consults/[id]/orders` | Create lab/radiology order |
| POST | `/api/consults/[id]/rx` | Create drug order |
| POST | `/api/consults/[id]/submit` | Finalize encounter |
| GET | `/api/consults/[id]/ai` | Stream Gemini clinical assist (SSE) |

All routes require authenticated session with role `doctor`, `hospital_admin`, or `platform_admin`. All write operations create `audit_log` entries.

---

## `/consults` — Doctor Queue List

Table of encounters assigned to the logged-in doctor:
- Columns: Patient name, Age, Chief complaint, Status (Pending / In progress / Completed), Encounter type, Start time
- Filters: Status, Date, Encounter type
- "New Encounter" button → `/consults/new`
- Click row → `/consults/[id]`

---

## Design Tokens

All Synapse design system tokens apply:
- Background: `var(--synapse-black)` for page, `var(--synapse-ink)` for panels
- Borders: `var(--synapse-border)`
- AI assistant card: `border border-[#F97316]/30 bg-[#F97316]/5`
- Allergy banner: `bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444]`
- Section headings: Syne font, `text-[#F97316]` accent
- STAT urgency badge: `bg-[#DC2626]/10 text-[#DC2626]`
- Auto-save indicator: small grey dot in top-right of notes section, pulses orange when saving

---

## Error Handling

- Network errors during auto-save: queue in localStorage, retry on reconnect (reuse `offlineStorage` from pharmacy app)
- AI assistant fails: show "AI unavailable — clinical judgment applies" banner, do not block form
- Drug interaction found: orange warning inline, cannot dismiss without acknowledging
- ICD-11 API offline: fall back to local `diagnoses` table search

---

## Out of Scope for This Sub-project

- Full telemedicine video integration in the workspace (LiveKit call page already exists separately)
- Patient-facing consultation summary PDF (Phase 2)
- E-prescription QR code PDF (Phase 2)
- Nurse handover integration
- Controlled drugs dual sign-off (Phase 2)
