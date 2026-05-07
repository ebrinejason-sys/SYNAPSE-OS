# Synapse OS — User & Data Flow
## How every user moves through the system

### 1. The Two Products

**Synapse OS** is the web‑based dashboard for healthcare facilities. Each facility gets a subdomain (e.g., `mengo.synapseos.tech`) or a custom domain. Staff log in and are routed to their role‑specific workspace.

**Synapse App** is the mobile (iOS/Android) and web (PWA) interface for patients and community members. It can also be used by staff for notifications and quick actions.

The two communicate through a central FHIR API. Any data sync (insurance, vitals, visit summaries) is initiated by the user explicitly or automatically with consent.

### 2. New Patient Visit (App User)

1. Patient opens App → books appointment at "Mengo Hospital"
2. App sends `POST /api/os/sync/insurance` with patient's policy details
3. At hospital, receptionist searches patient by phone → profile auto‑populated
4. Doctor encounter → AI diagnosis (pulls patient's wearable vitals from App, if affiliated)
5. After signature, OS sends `POST /api/app/sync/visit-summary` → App stores discharge summary, prescriptions, bill
6. Medication reminders created automatically on the App

### 3. Walk‑in Patient (No App)

1. Reception registers manually → system creates MRN
2. Same encounter flow; no pre‑fill
3. At discharge, patient receives SMS with visit summary link
4. Link opens a PWA page → patient can optionally download App and link MRN

### 4. Staff Member Using App

- A doctor gets an urgent notification (critical lab result) on their App
- Opens notification → navigates to the relevant encounter in the OS web view inside the App
- Can also use secure messaging to chat with colleagues or patients (E2E encrypted)

### 5. Public Health & Epidemiology

- Every diagnosis, death, and patient district (consent‑gated) feeds into the epidemiology engine
- Edge Functions run sentinel algorithms every 6 hours
- If an outbreak is detected, platform admin reviews → approves broadcast
- Approved broadcast pushes to App users in affected district(s)

### 6. Inter‑Hospital Referral Data Flow

1. Sending facility creates FHIR Referral Bundle (anonymised)
2. POST to receiving facility's API
3. Receiving admin views summary → accepts
4. On patient arrival, full records shared temporarily (with patient consent)
5. Original records always remain at sending facility

### 7. Demo & Investor Flow

- Investor lands on `synapseos.tech` → scrolls to interactive demo
- Clicks "Try the Demo" → `/demo` → no login required
- Browser loads sandboxed data → full encounter screen with live AI diagnosis
- Investor can also view Founders section, pricing, and apply for pilot access

**No dummy user account exists.** The sandbox is a separate schema in Supabase (`demo`), seeded with realistic but entirely isolated data, and is reset daily.

### 8. Doctor Encounter Flow (Detailed)

```
1. DOCTOR LOGIN
   ├─ Authenticates with facility credentials
   └─ Routed to `/os/doctor/queue`

2. QUEUE VIEW
   ├─ Displays patients sorted by:
   │  ├─ Acuity (Red → Yellow → Green)
   │  ├─ Wait time
   │  └─ Insurance status
   ├─ Search by MRN/name
   └─ Click patient → load encounter

3. ENCOUNTER INITIALIZATION
   ├─ Load patient demographics
   ├─ Fetch medical history
   ├─ Pull insurance data
   ├─ Display allergies & contraindications (in RED)
   └─ Show previous vitals

4. VITAL SIGNS ENTRY
   ├─ Temperature, BP, HR, RR, O₂
   ├─ Weight, height, BMI auto-calculated
   └─ Alert if abnormal (e.g., SpO₂ < 90%)

5. CHIEF COMPLAINT & HISTORY
   ├─ Document chief complaint
   ├─ History of presenting illness (HPI)
   ├─ Review of systems (ROS)
   └─ Past medical history (PMH)

6. PHYSICAL EXAM
   ├─ System-by-system documentation
   ├─ Structured dropdowns for findings
   └─ Free-text option

7. AI DIAGNOSIS
   ├─ Click "Run AI Diagnosis"
   ├─ Send vitals + HPI to Gemini
   ├─ Receive differential (Top 5)
   ├─ Each diagnosis shows:
   │  ├─ ICD-11 code
   │  ├─ Confidence score
   │  ├─ UCG citation
   │  ├─ Recommended labs
   │  └─ First-line treatment
   └─ Drug interaction check

8. ORDERS
   ├─ Labs
   │  ├─ Search by name/code
   │  ├─ Add to cart
   │  ├─ Review insurance coverage
   │  └─ Confirm order
   │
   ├─ Medications
   │  ├─ Drug interaction alert
   │  ├─ Dosing calculator
   │  ├─ Insurance copay display
   │  └─ Generate prescription QR
   │
   └─ Imaging
       ├─ Radiology ordering
       └─ Appointment booking

9. CLINICAL NOTES
   ├─ Assessment (AI-suggested ICD-11)
   ├─ Plan & recommendations
   ├─ Follow-up interval
   └─ Referral (if needed)

10. ELECTRONIC SIGNATURE
    ├─ Doctor enters PIN
    ├─ Timestamp recorded
    ├─ Auto-submit claim to insurance
    ├─ Book follow-up appointment
    ├─ Push discharge summary to patient App
    └─ Close encounter

11. QUEUE UPDATE
    ├─ Remove from queue
    ├─ Update statistics
    └─ Notify next patient
```

---

*All flows end at a functional page. Every link is accounted for. No 404s.*
