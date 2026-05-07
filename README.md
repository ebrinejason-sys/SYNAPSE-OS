# Synapse OS — Clinical Decision Support Platform
**Version 2.0 · Pre-Seed · YC-Ready**

<div align="center">
  
![Synapse Logo](public/assets/logos/synapse-logo.png)

**The Sovereign AI Health Operating System for Africa**

[Landing Page](#) · [Demo](#demo) · [Apply for Pilot](#apply) · [Documentation](#documentation)

</div>

---

## 🚀 Overview

Synapse OS is a revolutionary AI-powered healthcare platform designed for low-resource African settings. It provides:

- ✅ **Real-time AI Diagnosis** — Gemini-powered differential diagnosis with guideline grounding
- ✅ **Insurance Integration** — Live coverage checking and automated claim submission
- ✅ **Offline-First** — Full functionality without internet; syncs when connected
- ✅ **Clinical Guideline Grounding** — All recommendations backed by Uganda National Guidelines
- ✅ **Professional UI/UX** — Built with React 19, Vite, Tailwind CSS, and Framer Motion
- ✅ **HIPAA-Ready** — Encrypted data, role-based access, complete audit trails
- ✅ **Multi-Tenant** — Facility management, staff roles, customizable workflows

---

## 🎯 Demo Experience

### Live Interactive Demo (No Login Required)
Visit `http://localhost:3000/demo` to explore:

- **Public Landing Page** — Features, pricing, founders section
- **Doctor Queue** — Real-time patient list with acuity-based sorting
- **Patient Encounter** — 3-column clinical interface with AI diagnosis
- **Sandbox Data** — Isolated demo schema with 5+ facilities and 500+ patient records

### Demo Credentials (For Full Access)
```
Email:    demo@synapseos.tech
Password: Demo4321
```

---

## ⚡ Quick Start

### Prerequisites
- **Node.js** 18+
- **npm** or yarn
- **Supabase** account (free tier works)
- **Gemini API** key (free trial available)

### 1. Setup Environment

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your credentials
nano .env
```

**Required Environment Variables:**
```env
# Gemini AI (for diagnosis feature)
GEMINI_API_KEY=your_gemini_api_key

# Supabase (for demo data)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key

# Demo Account
DEMO_EMAIL=demo@synapseos.tech
DEMO_PASSWORD=Demo4321
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Setup Demo Schema

1. Go to Supabase dashboard → SQL Editor
2. Paste content from: `supabase/migrations/demo_schema_init.sql`
3. Execute the migration
4. This creates:
   - Facilities (Mengo Hospital + 11 others)
   - Patients (500+ with demographics)
   - Encounters (active OPD cases)
   - Clinical guidelines (Uganda national standards)
   - Insurance providers
   - Lab/pharmacy orders

### 4. Start Development Server

```bash
npm run dev
```

Open browser:
- **Demo Landing:** http://localhost:3000/demo
- **Doctor Dashboard:** http://localhost:3000/demo/doctor
- **Full App:** http://localhost:3000

---

## 📁 Project Structure

```
SYNAPSE-OS/
│
├── src/
│   ├── pages/
│   │   ├── demo/                    # Public demo pages
│   │   │   ├── DemoSandbox.tsx     # Router & layout
│   │   │   └── DemoLandingPage.tsx # Hero, features, CTA
│   │   │
│   │   ├── os/                      # Healthcare OS pages
│   │   │   ├── DoctorQueue.tsx     # Patient queue (acuity-sorted)
│   │   │   ├── EncounterScreen.tsx # 3-column clinical interface
│   │   │   ├── AuditLog.tsx        # Audit trail
│   │   │   └── ...
│   │   │
│   │   ├── app/                     # Patient app pages
│   │   │   ├── PatientDashboard.tsx
│   │   │   └── ...
│   │   │
│   │   ├── auth/
│   │   │   ├── Login.tsx
│   │   │   ├── SignUp.tsx
│   │   │   └── ...
│   │   │
│   │   ├── marketing/
│   │   │   ├── LandingPage.tsx
│   │   │   ├── PilotApply.tsx
│   │   │   └── SimplePage.tsx
│   │   │
│   │   └── LandingPage.tsx
│   │
│   ├── components/                  # Reusable React components
│   │   └── (to be created)
│   │
│   ├── hooks/
│   │   └── useDemoData.ts          # Supabase data fetching hooks
│   │       ├── useDemoPatientQueue()
│   │       ├── useDemoEncounter()
│   │       ├── useDemoGuidelines()
│   │       └── useDemoAuth()
│   │
│   ├── lib/
│   │   ├── supabase.ts             # Supabase client & queries
│   │   ├── theme.ts                # Professional color scheme
│   │   └── utils.ts                # Helper functions
│   │
│   ├── services/
│   │   ├── geminiService.ts        # AI diagnosis integration
│   │   └── auditService.ts         # Audit logging
│   │
│   ├── types.ts                     # TypeScript interfaces
│   ├── constants.ts                 # Demo data constants
│   ├── App.tsx                      # Main router
│   ├── main.tsx                     # Entry point
│   └── index.css                    # Global styles + theme
│
├── supabase/
│   └── migrations/
│       └── demo_schema_init.sql    # Complete schema + seed data
│
├── public/
│   └── assets/
│       └── logos/
│           ├── synapse-logo.png
│           └── synapse-icon.jpg
│
├── .env                             # Environment config (gitignored)
├── .env.example                     # Template
├── package.json
├── vite.config.ts
├── tsconfig.json
├── index.html
└── README.md
```

---

## 🎨 Professional Theme

### Color Palette
| Color | Hex | Usage |
|-------|-----|-------|
| **Synapse Green** | #22c55e | Primary buttons, alerts, accents |
| **Emerald** | #10b981 | Secondary, links, hovers |
| **Sky Blue** | #0ea5e9 | Accent features, info |
| **Success** | #10b981 | Green status, confirmations |
| **Warning** | #f59e0b | Yellow alerts, cautions |
| **Error** | #ef4444 | Red alerts, critical values |
| **Neutral** | #111827-#f9fafb | Text, backgrounds, borders |

### Typography
- **Body Font:** Inter (modern, readable)
- **Serif:** Playfair Display (headings)
- **Mono:** JetBrains Mono (code, data)

### Components
```tsx
<button className="btn-primary">Save Encounter</button>
<button className="btn-secondary">Cancel</button>
<button className="btn-outline">Learn More</button>

<div className="card">Professional card</div>
<div className="card-elevated">Elevated with shadow</div>
<div className="card-interactive">Hover effect</div>

<input className="input" placeholder="Search..." />

<span className="badge badge-success">Active</span>
<span className="badge badge-warning">Pending</span>
<span className="badge badge-error">Critical</span>

<div className="status-dot status-active"></div>
```

---

## 🔌 Supabase Integration

### Demo Schema Tables

```sql
demo.facilities          -- Hospital configurations
demo.patients            -- Patient demographics
demo.encounters          -- Clinical encounters (OPD, admissions)
demo.encounter_diagnoses -- ICD-11 diagnoses
demo.observations        -- Vitals, lab results
demo.lab_orders          -- Lab order queue
demo.lab_results         -- Lab results storage
demo.pharmacy_orders     -- Prescription queue
demo.pharmacy_order_items-- Individual medications
demo.clinical_guidelines -- Uganda national guidelines
demo.insurance_providers -- Insurance company configs
demo.orders              -- Generic order system
```

### Data Hooks

```tsx
import { 
  useDemoPatientQueue, 
  useDemoEncounter, 
  useDemoGuidelines 
} from '@/hooks/useDemoData';

// Get OPD queue for facility
const { patients, loading, error } = useDemoPatientQueue(facilityId);

// Get encounter details with relationships
const { encounter, loading, error } = useDemoEncounter(encounterId);

// Get clinical guidelines by condition
const { guidelines, loading, error } = useDemoGuidelines('Pneumonia');

// Get current user
const { user, loading } = useDemoAuth();
```

---

## 🧠 AI Diagnosis Feature

The "Run AI Diagnosis" button on encounters:

1. **Collects Context**
   - Chief complaint
   - Vitals (temperature, BP, HR, RR, O₂)
   - Patient history & allergies
   - Current medications

2. **Calls Gemini API**
   ```
   POST https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent
   ```

3. **Returns Differential**
   - Top 5 diagnoses with confidence scores
   - ICD-11 codes
   - Uganda Clinical Guidelines citations
   - Recommended labs/imaging
   - Drug interactions

4. **Grounds in Evidence**
   - All recommendations backed by guideline queries
   - Contraindication checking
   - Dosing calculations

**Configuration:**
```env
GEMINI_API_KEY=your_api_key_here
```

---

## 📱 Key Routes & Pages

### Public Routes
```
/                    Landing page
/demo                Demo sandbox (interactive)
/demo/doctor         Doctor queue
/demo/encounter/:id  Patient encounter
/apply               Pilot application
/pricing             Pricing tiers
/about, /blog        Marketing pages
/legal/privacy       Privacy policy
/legal/terms         Terms of service
```

### OS Routes (Healthcare Staff)
```
/os/doctor/queue           Patient queue
/os/doctor/encounter/:id   Clinical interface
/os/nurse/ward             Ward management
/os/lab/orders             Lab order queue
/os/pharmacy/queue         Pharmacy queue
/os/admin/overview         Admin dashboard
/os/admin/staff            Staff management
/os/audit                  Audit logs
```

### App Routes (Patients)
```
/app/dashboard             Health dashboard
/app/appointments          Booking & history
/app/records               Medical records
/app/bills                 Billing
```

---

## 🏗️ Build & Deploy

### Development
```bash
npm run dev
# Server runs on http://localhost:3000
# Hot reload enabled
```

### Production Build
```bash
npm run build
# Outputs to: dist/
npm run preview
# Preview build locally
```

### TypeScript Check
```bash
npm run lint
# Checks for type errors
```

### Docker Deployment
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json .
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
ENV NODE_ENV=production
CMD ["npm", "run", "preview"]
```

---

## 🔐 Security & Compliance

- ✅ **Encryption:** End-to-end data encryption in transit
- ✅ **HIPAA Ready:** Role-based access control, audit trails
- ✅ **RLS Policies:** Row-level security in Supabase
- ✅ **Audit Logs:** Complete activity logging
- ✅ **Offline-First:** No data loss during disconnection
- ✅ **Privacy:** No third-party data sharing

---

## 🐛 Troubleshooting

### Supabase Connection Failed
```
Error: Failed to connect to Supabase
```
**Solution:**
- Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env`
- Check that demo schema exists
- Ensure RLS policies allow anonymous access

### Demo Data Not Loading
```
Error: useDemoPatientQueue - undefined facility
```
**Solution:**
- Run migration: `supabase/migrations/demo_schema_init.sql`
- Check browser console (F12)
- Verify Supabase credentials

### AI Diagnosis Not Working
```
Error: Gemini API quota exceeded
```
**Solution:**
- Check `GEMINI_API_KEY` is valid
- Verify API has quota available
- Try with test prompt

### Styling Broken
```
CSS not applying, Tailwind not working
```
**Solution:**
```bash
npm run clean
npm run dev
# Force refresh: Ctrl+Shift+R
```

---

## 📊 Demo Statistics

| Metric | Value |
|--------|-------|
| **Facilities** | 12 (all pre-seeded) |
| **Patients** | 500+ (with complete demographics) |
| **Encounters** | 1000+ (OPD, admissions, follow-ups) |
| **Guidelines** | 50+ (Uganda clinical standards) |
| **Insurance Providers** | 8 (NHIS, private) |
| **API Response Time** | <200ms (Supabase) |

---

## 🎓 For YC Reviewers

**Demo Access:**
- No sign-up required
- Navigate to: `http://localhost:3000/demo`
- Full patient queue and encounter interface
- Real AI diagnosis with Gemini integration

**Key Differentiators:**
1. **Guideline Grounding** — All recommendations cite Uganda Clinical Guidelines
2. **Offline-First** — Works without internet
3. **Insurance Integration** — Real-time coverage checking
4. **Multi-Tenant** — Facility management built-in
5. **Proven Team** — Healthcare + tech founders

**Market Opportunity:**
- TAM: $40M+ (East Africa healthcare IT)
- Initial Market: Uganda (50M population, 5K+ facilities)
- Unit Economics: 60% gross margins on SaaS

---

## 📞 Support & Partnerships

- **Email:** info@synapseos.tech
- **Website:** https://synapseos.tech
- **Apply for Pilot:** https://synapseos.tech/apply
- **Documentation:** [Full MRD](SYNAPSEOS_MRD.md)

---

## 📄 License

© 2026 Synapse Health. All rights reserved.

Built with ❤️ for Africa 🌍
