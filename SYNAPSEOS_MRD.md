# Synapse Ecosystem — Master Requirements Document
## Version 2.0 · Pre‑Seed · YC‑Ready

### 1. Vision
Synapse is the sovereign AI health operating system for Africa. Two integrated products — **Synapse OS** (facility platform) and **Synapse App** (consumer application) — connected via real‑time FHIR APIs, grounded in national clinical guidelines, and operating offline‑first.

**No dummy users.** All demonstration is provided via a public, unauthenticated interactive sandbox loaded with realistic but fully isolated example data. Every real user is a human with a purpose.

### 2. Ecosystem Architecture

| Component | Audience | Primary Domain |
|-----------|----------|----------------|
| **Synapse OS** | Hospital staff (doctors, nurses, admin) | `[slug].synapseos.tech` (or custom domain) |
| **Synapse App** | Patients, community, CHWs, staff (mobile) | Mobile app (iOS/Android) + PWA at `app.synapseos.tech` |
| **Landing / Marketing** | Investors, pilot applicants, general public | `synapseos.tech` |
| **Platform Admin** | Synapse team (founders) | `admin.synapseos.tech` |

**Communication:** All data exchange happens via the FHIR R4 API at `api.synapseos.tech`. App users can affiliate with facilities and receive/dispatch data securely.

### 3. User Journeys (No Dead Ends)

All flows are end‑to‑end. Every action leads to a real page or a recorded event. Not a single link returns 404.

#### 3.1 Hospital Administrator Onboarding
1. Land on `synapseos.tech` → click **"Apply for Pilot Access"** → `/apply`
2. Fill facility application form → submit → confirmation page
3. Platform admin reviews at `admin.synapseos.tech/applications` → approves
4. System provisions subdomain (`mengo.synapseos.tech`), seeds departments & default insurance providers, creates admin account
5. Admin receives invitation email (Resend) → sets password → logs in
6. **Setup wizard (7 steps):** Facility Profile → Departments → Staff → Billing → Pharmacy → Insurance → Guidelines
7. Dashboard unlocks → facility is live

#### 3.2 Doctor Encounter (OPD)
1. Login at facility domain → `/doctor/queue`
2. Real‑time patient list, sorted by **acuity** (Red → Yellow → Green)
3. Click a patient → encounter screen opens (3‑column)
   - **Left:** Patient context (allergies in red, active meds, insurance, last visits)
   - **Center:** Tabs → History, Exam, Diagnosis (Run AI → shows ICD‑11 + UCG citation), Orders, Notes, Signature
   - **Right:** Persistent AI panel (guideline ground, drug interactions, lab interpretation)
4. Order labs/meds → inline insurance coverage check → real‑time queue update for lab/pharmacy
5. Sign with PIN → auto‑submits claim, books follow‑up, pushes summary to patient App

#### 3.3 Patient with App (Pre‑visit & Post‑visit)
1. Download Synapse App → sign up (phone/email) → full consent modal
2. Add insurance (wallet), connect wearable (Apple Watch/Fitbit)
3. Book appointment → pre‑shares health summary + insurance with facility
4. **At facility:** Reception confirms identity, all data pre‑filled
5. Doctor encounter → AI diagnosis, lab order, prescription
6. **Post‑visit:** Push notification for lab result → tap → AI interpretation in plain language
7. Medication reminders automatically created in app

#### 3.4 Patient without App
1. Walk‑in registration → receptionist enters demographics, insurance card
2. Same encounter flow; all communication via SMS (Twilio)
3. Printed MRN card with QR to download app later → retroactively links records

#### 3.5 Pharmacist Dispensing
1. `/pharmacy/queue` → sees STAT order from doctor
2. Dispense flow: scan prescription QR → scan drug barcode → drug interaction check (inline alert) → FEFO batch selected → insurance co‑pay displayed → confirm → inventory deducted → label printed
3. Walk‑in POS (Habakkuk module): product search, add to cart, mobile money payment, receipt

#### 3.6 Lab Technician
1. `/lab/orders` → sorted by urgency
2. Collect specimen → print label (barcode)
3. Enter result (or instrument auto‑ingest via ASTM bridge) → validate against reference ranges
4. Critical value → confirmation dialog → doctor notified instantly
5. Supervisor authorises → result released to encounter AI panel and patient App

#### 3.7 Inter‑Hospital Referral
1. Doctor selects "Referral" in encounter → sends FHIR bundle (anonymised summary) to target facility
2. Target facility admin receives notification → accepts → assigns bed
3. On patient arrival, temporary cross‑tenant access granted

#### 3.8 Telemedicine
1. Patient opens App → chatbot symptom checker (13 steps) → triage (Emergency/Urgent/Routine)
2. If Urgent: books same‑day slot → at time, joins LiveKit video call
3. Doctor sees patient intake summary, conducts call, AI drafts SOAP note post‑call
4. Prescription pushed to App

#### 3.9 Founders / YC Reviewers Demo
Instead of a dummy user, the demo at `synapseos.tech/demo` is a **public sandbox**. No login. The page loads a pre‑seeded, isolated database schema (`demo`) that mirrors real clinical data. The reviewer can:
- See the doctor queue with realistic patient cards
- Click a patient → full 3‑column encounter
- Click "Run AI Diagnosis" → real Gemini API call returns differential with UCG citations
- Explore departments, scoring tools, and landing sections

All actions are recorded only in the sandbox, which is reset periodically. Zero risk to production data.

### 4. Page Inventory (Every Route Returns 200)

**Public / Marketing:**
`/` (landing), `/about`, `/blog`, `/contact`, `/careers`, `/features`, `/pricing`, `/docs`, `/status`, `/changelog`, `/apply`, `/investor-deck`

**Auth:**
`/login`, `/signup`, `/forgot-password`, `/reset-password`, `/unauthorized`, `/maintenance`

**Demo (public, no auth):**
`/demo`, `/demo/doctor`, `/demo/encounter`

**OS Authenticated (by role):**
`/doctor/queue`, `/doctor/encounter/[id]`, `/nurse/ward`, `/nurse/mar`, `/nurse/handover`, `/lab/orders`, `/lab/results`, `/pharmacy/queue`, `/pharmacy/pos`, `/admin/overview`, `/admin/staff`, `/admin/billing`, `/admin/insurance`, `/admin/settings`

**Patient Portal (authenticated):**
`/patient/dashboard`, `/patient/records`, `/patient/appointments`, `/patient/bills`, `/patient/medical-id`

**API (backend):**
`/api/ai/diagnose`, `/api/scores/calculate`, `/api/lab/instrument-ingest`, `/api/patient-history/summarize`, `/api/public/stats`, `/api/insurance/check-coverage`, `/fhir/Patient/[id]`, `/fhir/Observation`, etc.

**Legal:**
`/legal/privacy`, `/legal/terms`, `/legal/dpa`, `/legal/accessibility`, `/legal/cookie-policy`, `/legal/facility-agreement`, `/legal/partnership-agreement`, `/legal/consent-withdrawal`

### 5. Required Environment Variables (All Already Defined)
See `.env.example` for complete list.

### 6. YC Application & Google for Startups Alignment
- **Landing page** includes a dedicated "Founders" section with Jason Ebrine Tushabe (CEO/CTO) and Nathan David (COO), each with photo and LinkedIn link
- Product demo accessible without login via `/demo`
- Clear SaaS pricing tiers visible
- Contact information and legal links in footer

---

*For detailed ecosystem flows, see `SYNAPSEOS_ECOSYSTEM_FLOW.md`*
