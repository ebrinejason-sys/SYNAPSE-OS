import Link from 'next/link'
import Image from 'next/image'
import { SynapseLogo } from '../components/SynapseLogo'
import { ThemeToggle } from '../components/ThemeToggle'
import { FeatureTabs } from '../components/landing/FeatureTabs'
import { DemoWidget } from '../components/landing/DemoWidget'
import { NewsletterForm } from '../components/landing/NewsletterForm'
import { LandingHero } from '../components/landing/LandingHero'
import { TrustMarquee } from '../components/landing/TrustMarquee'

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="section-label mb-3" style={{ color: 'var(--text-muted)' }}>
      {children}
    </p>
  )
}

const MODULES = [
  { abbr: 'OPD', name: 'OPD / Consultation', desc: 'Queue, consultation notes, fee schedules' },
  { abbr: 'A&E', name: 'Emergency A&E', desc: 'ESI triage, START, resuscitation records' },
  { abbr: 'MAT', name: 'Maternity', desc: 'ANC, partograph, delivery, PMTCT, MPDSR' },
  { abbr: 'PAE', name: 'Paediatrics', desc: 'WHO growth charts, immunisation, CMAM' },
  { abbr: 'HIV', name: 'HIV / ART', desc: 'Enrolment, regimens, viral load tracking' },
  { abbr: 'ICU', name: 'ICU', desc: 'Flowsheets, SOFA/APACHE, sepsis bundle' },
  { abbr: 'THR', name: 'Surgery / Theatre', desc: 'WHO SSC checklist, intra-op, PACU' },
  { abbr: 'CDO', name: 'Cardiology', desc: 'ECG workflow, TIMI, GRACE, CHA₂DS₂-VASc' },
  { abbr: 'ONC', name: 'Oncology', desc: 'TNM staging, chemo protocols, CTCAE' },
  { abbr: 'MHU', name: 'Mental Health', desc: 'PHQ-9, GAD-7, C-SSRS, safety planning' },
  { abbr: 'REN', name: 'Renal / Dialysis', desc: 'Session records, CKD staging' },
  { abbr: 'CHM', name: 'Care Home', desc: 'Care plans, Barthel, falls risk' },
  { abbr: 'CHW', name: 'Community Health', desc: 'CHW mobile, household surveys' },
  { abbr: 'TCH', name: 'Teaching Hospital', desc: 'Ward rounds, M&M conferences' },
  { abbr: 'LAB', name: 'Laboratory', desc: 'Orders, results, QC, instrument ingest' },
  { abbr: 'PHM', name: 'Pharmacy', desc: 'FEFO dispense, POS, interactions' },
  { abbr: 'RAD', name: 'Radiology', desc: 'Orders, PACS/DICOM integration' },
  { abbr: 'FIN', name: 'Finance', desc: 'Invoicing, mobile money, insurance claims' },
  { abbr: 'REC', name: 'Reception', desc: 'Registration, appointments, triage queue' },
  { abbr: 'TEL', name: 'Telemedicine', desc: 'Intake chatbot, video consult, SOAP notes' },
]

const DEPLOY_STEPS = [
  {
    title: 'Apply & scope',
    body: 'Tell us your facility type, departments, and current records setup. We confirm fit and assign a pilot contact.',
  },
  {
    title: 'Provision tenant',
    body: 'We create your hospital subdomain, roles, and department modules. Staff accounts are issued with activation email.',
  },
  {
    title: 'Migrate & train',
    body: 'Import patients, stock, or legacy exports where available. On-site or remote training for clinical and admin leads.',
  },
  {
    title: 'Go live & support',
    body: 'Phased rollout by ward or department. Email and priority support on paid tiers; audit logs from day one.',
  },
]

const TIERS = [
  {
    name: 'Trial',
    price: 'Free',
    period: '30 days',
    description: 'Evaluate the platform with one department and a small staff group.',
    highlight: false,
    badge: null,
    features: ['1 department', 'Up to 10 staff', 'Core AI diagnosis', 'Community support'],
    cta: 'Start trial',
    ctaHref: '/signup?plan=trial',
  },
  {
    name: 'Starter',
    price: 'UGX 250,000',
    period: '/month',
    description: 'Small clinics and health centres.',
    highlight: false,
    badge: null,
    features: ['3 departments', 'Up to 25 staff', 'Full AI diagnosis', 'Basic insurance copilot', 'Email support'],
    cta: 'Subscribe',
    ctaHref: '/signup?plan=starter',
  },
  {
    name: 'Professional',
    price: 'UGX 750,000',
    period: '/month',
    description: 'Hospitals running multiple departments.',
    highlight: true,
    badge: 'Common choice',
    features: [
      'All departments',
      'Up to 100 staff',
      'AI + UCG-grounded RAG',
      'Full insurance copilot',
      'API access',
      'Custom domain',
      'Priority support',
    ],
    cta: 'Subscribe',
    ctaHref: '/signup?plan=professional',
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: 'pricing',
    description: 'Hospital networks and referral centres.',
    highlight: false,
    badge: null,
    features: [
      'Unlimited departments & staff',
      'Dedicated customer success',
      'On-premise option',
      'SLA 99.9%',
      'SAML / SSO',
    ],
    cta: 'Contact sales',
    ctaHref: '/contact?intent=enterprise',
  },
]

type Cell = 'yes' | 'no' | 'partial'
const COMPARE_ROWS: { feature: string; synapse: Cell; openmrs: Cell; slade: Cell; paper: Cell }[] = [
  { feature: 'AI differential diagnosis (UCG-grounded)', synapse: 'yes', openmrs: 'no', slade: 'no', paper: 'no' },
  { feature: 'Offline-first with sync', synapse: 'yes', openmrs: 'partial', slade: 'no', paper: 'yes' },
  { feature: 'FHIR R4 resources', synapse: 'yes', openmrs: 'yes', slade: 'partial', paper: 'no' },
  { feature: 'Insurance claim copilot', synapse: 'yes', openmrs: 'no', slade: 'partial', paper: 'no' },
  { feature: 'ICD-11 coding on output', synapse: 'yes', openmrs: 'partial', slade: 'partial', paper: 'no' },
  { feature: 'Uganda Clinical Guidelines in workflow', synapse: 'yes', openmrs: 'no', slade: 'yes', paper: 'no' },
  { feature: 'Patient mobile app', synapse: 'yes', openmrs: 'no', slade: 'no', paper: 'no' },
  { feature: 'Integrated pharmacy POS', synapse: 'yes', openmrs: 'no', slade: 'yes', paper: 'no' },
  { feature: 'DHIS2 export pipeline', synapse: 'yes', openmrs: 'no', slade: 'no', paper: 'no' },
]

function CompareCell({ v }: { v: Cell }) {
  if (v === 'yes') return <span className="text-green-500 font-medium">Yes</span>
  if (v === 'no') return <span className="text-red-400 font-medium">No</span>
  return <span className="text-amber-400 font-medium">Partial</span>
}

const STANDARDS = [
  { name: 'FHIR R4', detail: 'Interoperability resources for patients, encounters, claims' },
  { name: 'ICD-11', detail: 'Diagnosis and procedure coding on clinical output' },
  { name: 'DHIS2', detail: 'Scheduled anonymised export for national reporting' },
  { name: 'HL7 / ASTM', detail: 'Lab instrument messaging bridges' },
  { name: 'DPPA 2019', detail: 'Uganda data protection baseline in product design' },
]

const TRUST = [
  { title: 'Row-level security', desc: 'Tenant isolation on clinical tables via Postgres RLS' },
  { title: 'Audit trail', desc: 'Actor, timestamp, and action logged for sensitive operations' },
  { title: 'TLS in transit', desc: 'HTTPS for web, API, and admin surfaces' },
  { title: 'Offline-capable', desc: 'Local server mode for wards when uplink drops' },
  { title: 'Role-based access', desc: 'Doctor, nurse, pharmacist, billing, and admin roles' },
  { title: 'Session revocation', desc: 'Password reset and logout invalidate server-side sessions' },
]

const NAV = [
  ['#products', 'Products'],
  ['#features', 'Features'],
  ['#modules', 'Modules'],
  ['#pricing', 'Pricing'],
  ['#demo', 'Demo'],
  ['/docs', 'Docs'],
]

export default function HomePage() {
  return (
    <div style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
      <nav
        className="sticky top-0 z-50 flex items-center justify-between px-6 py-3.5"
        style={{
          background: 'var(--nav-glass)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <SynapseLogo size="md" />
        <div className="hidden md:flex items-center gap-7">
          {NAV.map(([href, label]) => (
            <a key={label} href={href} className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {label}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link href="/login" className="text-sm hidden md:block" style={{ color: 'var(--text-secondary)' }}>
            Sign in
          </Link>
          <Link
            href="/apply"
            className="text-sm font-semibold px-4 py-2 rounded-lg"
            style={{ background: 'var(--brand-orange)', color: '#07070A' }}
          >
            Apply for pilot
          </Link>
        </div>
      </nav>

      <TrustMarquee />
      <LandingHero />

      {/* Problem */}
      <section className="px-6 py-20" style={{ borderBottom: '1px solid var(--border-edge)' }}>
        <div className="max-w-5xl mx-auto grid lg:grid-cols-2 gap-12">
          <div>
            <SectionLabel>Context</SectionLabel>
            <h2 className="font-display font-bold text-3xl mb-4" style={{ letterSpacing: '-0.02em' }}>
              Why hospitals need a single clinical record
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Fragmented paper files, separate billing spreadsheets, and pharmacy stock kept in isolation
              make continuity of care and revenue collection harder. SynapseOS connects encounters, orders,
              results, dispense, and claims in one audit-backed system.
            </p>
            <p className="text-xs mt-4" style={{ color: 'var(--text-muted)' }}>
              Uganda doctor-to-population ratio is well below WHO recommendations (MOH / WHO public data).
            </p>
          </div>
          <div className="space-y-4">
            {[
              { title: 'Continuity', body: 'One patient record across OPD, ward, lab, pharmacy, and billing.' },
              { title: 'Revenue', body: 'Fee schedules, invoicing, and insurer claim submission from signed encounters.' },
              { title: 'Reporting', body: 'DHIS2 exports and SDG-mapped indicators from live clinical data.' },
            ].map((item) => (
              <div
                key={item.title}
                className="p-5 rounded-xl"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)' }}
              >
                <p className="font-semibold text-sm mb-1">{item.title}</p>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Products */}
      <section id="products" className="px-6 py-20" style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-edge)' }}>
        <div className="max-w-5xl mx-auto">
          <SectionLabel>Products</SectionLabel>
          <h2 className="font-display font-bold text-3xl mb-10">Three products on one platform</h2>
          <div className="grid lg:grid-cols-3 gap-6">
            <article className="p-6 rounded-xl" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-edge)' }}>
              <p className="text-xs font-semibold mb-2" style={{ color: 'var(--brand-orange)' }}>
                Hospitals & clinics
              </p>
              <h3 className="font-display font-bold text-xl mb-3">SynapseOS</h3>
              <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
                Web HMIS: encounters, nursing, lab, radiology, theatre, finance, and admin — each hospital
                on its own tenant with role-based access.
              </p>
              <Link href="/apply" className="text-sm font-semibold" style={{ color: 'var(--brand-orange)' }}>
                Apply for deployment →
              </Link>
            </article>
            <article className="p-6 rounded-xl" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-edge)' }}>
              <p className="text-xs font-semibold mb-2" style={{ color: '#22C55E' }}>
                Pharmacies
              </p>
              <h3 className="font-display font-bold text-xl mb-3">Synapse Pharm</h3>
              <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
                Inventory, FEFO batching, POS, supplier orders, and patient refill requests. Hosted at{' '}
                <span className="font-mono text-xs">pharm.synapseos.tech</span> or a custom domain.
              </p>
              <Link href="/contact?intent=pharmacy" className="text-sm font-semibold" style={{ color: '#22C55E' }}>
                Enrol a pharmacy →
              </Link>
            </article>
            <article className="p-6 rounded-xl" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-edge)' }}>
              <p className="text-xs font-semibold mb-2" style={{ color: 'var(--brand-gold)' }}>
                Patients
              </p>
              <h3 className="font-display font-bold text-xl mb-3">Synapse App</h3>
              <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
                Android app for appointments, lab results, telemedicine intake, and health bulletins when
                connected to a Synapse-network facility.
              </p>
              <Link href="/download" className="text-sm font-semibold" style={{ color: 'var(--brand-gold)' }}>
                Download or join waitlist →
              </Link>
            </article>
          </div>
        </div>
      </section>

      {/* Deployment */}
      <section id="deploy" className="px-6 py-20" style={{ borderBottom: '1px solid var(--border-edge)' }}>
        <div className="max-w-5xl mx-auto">
          <SectionLabel>Deployment</SectionLabel>
          <h2 className="font-display font-bold text-3xl mb-10">How a hospital goes live</h2>
          <ol className="grid md:grid-cols-2 gap-6">
            {DEPLOY_STEPS.map((step, i) => (
              <li
                key={step.title}
                className="p-6 rounded-xl"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)' }}
              >
                <p className="text-xs font-mono mb-2" style={{ color: 'var(--text-muted)' }}>
                  Step {i + 1}
                </p>
                <p className="font-semibold mb-2">{step.title}</p>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="px-6 py-20" style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-edge)' }}>
        <div className="max-w-5xl mx-auto">
          <SectionLabel>Capabilities</SectionLabel>
          <h2 className="font-display font-bold text-3xl mb-3">What the platform includes</h2>
          <p className="text-sm mb-10 max-w-2xl" style={{ color: 'var(--text-secondary)' }}>
            Select a area to see implemented workflows. AI features require clinician review before
            clinical decisions.
          </p>
          <FeatureTabs />
        </div>
      </section>

      {/* Modules */}
      <section id="modules" className="px-6 py-20" style={{ borderBottom: '1px solid var(--border-edge)' }}>
        <div className="max-w-5xl mx-auto">
          <SectionLabel>Modules</SectionLabel>
          <h2 className="font-display font-bold text-3xl mb-3">Department modules</h2>
          <p className="text-sm mb-10" style={{ color: 'var(--text-secondary)' }}>
            Enable only the modules your facility needs. Each module ships with role permissions and
            department-specific forms.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {MODULES.map((m) => (
              <div
                key={m.name}
                className="p-4 rounded-lg"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)' }}
              >
                <span
                  className="inline-block font-mono text-xs font-bold px-2 py-0.5 rounded mb-2"
                  style={{ background: 'rgba(249,115,22,0.1)', color: 'var(--brand-orange)' }}
                >
                  {m.abbr}
                </span>
                <p className="font-semibold text-sm">{m.name}</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  {m.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Reporting */}
      <section className="px-6 py-20" style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-edge)' }}>
        <div className="max-w-5xl mx-auto grid lg:grid-cols-2 gap-10 items-start">
          <div>
            <SectionLabel>Reporting</SectionLabel>
            <h2 className="font-display font-bold text-3xl mb-4">National and donor reporting</h2>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Encounters, outcomes, and programme indicators can be mapped to SDG goals and exported for
              DHIS2. Facilities configure which indicators apply; exports run on a schedule with
              anonymisation rules — not sample dashboard percentages.
            </p>
          </div>
          <ul className="space-y-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <li className="p-4 rounded-lg" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-edge)' }}>
              Nightly DHIS2-compatible export pipeline (tenant-configured)
            </li>
            <li className="p-4 rounded-lg" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-edge)' }}>
              SDG command centre: drill-down from aggregate goals to underlying encounters
            </li>
            <li className="p-4 rounded-lg" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-edge)' }}>
              MPDSR and surveillance hooks for maternal death and outbreak signals
            </li>
          </ul>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="px-6 py-20" style={{ borderBottom: '1px solid var(--border-edge)' }}>
        <div className="max-w-5xl mx-auto">
          <SectionLabel>Pricing</SectionLabel>
          <h2 className="font-display font-bold text-3xl mb-2">Plans (UGX)</h2>
          <p className="text-sm mb-10" style={{ color: 'var(--text-muted)' }}>
            Prices shown on the marketing site; confirm current rates with sales before procurement.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {TIERS.map((tier) => (
              <div
                key={tier.name}
                className="p-5 rounded-xl flex flex-col"
                style={{
                  background: 'var(--bg-surface)',
                  border: tier.highlight ? '1px solid var(--brand-orange)' : '1px solid var(--border-edge)',
                }}
              >
                {tier.badge && (
                  <span className="text-xs font-semibold mb-2" style={{ color: 'var(--brand-orange)' }}>
                    {tier.badge}
                  </span>
                )}
                <p className="font-bold">{tier.name}</p>
                <p className="font-display font-bold text-xl my-1">
                  {tier.price}
                  <span className="text-xs font-normal ml-1" style={{ color: 'var(--text-muted)' }}>
                    {tier.period}
                  </span>
                </p>
                <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
                  {tier.description}
                </p>
                <ul className="text-xs space-y-1.5 flex-1 mb-4" style={{ color: 'var(--text-secondary)' }}>
                  {tier.features.map((f) => (
                    <li key={f}>· {f}</li>
                  ))}
                </ul>
                <Link
                  href={tier.ctaHref}
                  className="text-center text-sm font-semibold py-2 rounded-lg"
                  style={{
                    background: tier.highlight ? 'var(--brand-orange)' : 'var(--bg-overlay)',
                    color: tier.highlight ? '#07070A' : 'var(--text-primary)',
                  }}
                >
                  {tier.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Demo */}
      <section id="demo" className="px-6 py-20" style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-edge)' }}>
        <div className="max-w-3xl mx-auto">
          <SectionLabel>Demo</SectionLabel>
          <h2 className="font-display font-bold text-3xl mb-2">Try the diagnosis assistant</h2>
          <p className="text-sm mb-8" style={{ color: 'var(--text-secondary)' }}>
            Enter symptoms below. This demo calls the same API used in development; results are for
            illustration and not a substitute for clinical judgement.
          </p>
          <DemoWidget />
        </div>
      </section>

      {/* Pilot */}
      <section id="pilot" className="px-6 py-20" style={{ borderBottom: '1px solid var(--border-edge)' }}>
        <div className="max-w-5xl mx-auto">
          <SectionLabel>Pilot programme</SectionLabel>
          <h2 className="font-display font-bold text-3xl mb-6">What hospitals evaluate in a pilot</h2>
          <p className="text-sm mb-8 max-w-2xl" style={{ color: 'var(--text-secondary)' }}>
            We do not publish anonymous quotes or unaudited performance percentages on this page. During
            pilot, facilities measure outcomes that matter to them — typically documentation time, claim
            turnaround, stock accuracy, and staff adoption.
          </p>
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            {[
              'Workflow fit per department (OPD, ward, lab, pharmacy)',
              'Data migration from spreadsheets or legacy exports',
              'Staff training and role assignment',
              'Insurance claim submission and rejection handling',
              'Offline behaviour on your network',
              'Export to DHIS2 / internal dashboards',
            ].map((item) => (
              <div
                key={item}
                className="p-4 rounded-lg"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)' }}
              >
                {item}
              </div>
            ))}
          </div>
          <Link href="/apply" className="inline-block mt-8 text-sm font-semibold" style={{ color: 'var(--brand-orange)' }}>
            Submit a pilot application →
          </Link>
        </div>
      </section>

      {/* Team */}
      <section className="px-6 py-20" style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-edge)' }}>
        <div className="max-w-3xl mx-auto">
          <SectionLabel>Team</SectionLabel>
          <h2 className="font-display font-bold text-3xl mb-8">People building SynapseOS</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="flex gap-4 p-5 rounded-xl" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-edge)' }}>
              <Image src="/team/founder.jpg" alt="Ebrine Tushabe" width={64} height={64} unoptimized className="rounded-lg object-cover shrink-0" />
              <div>
                <p className="font-semibold">Ebrine Tushabe</p>
                <p className="text-xs mb-2" style={{ color: 'var(--brand-orange)' }}>
                  Founder & CEO
                </p>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Product engineering and hospital deployments.
                </p>
                <a href="mailto:hello@synapseos.tech" className="text-xs mt-2 inline-block" style={{ color: 'var(--brand-orange)' }}>
                  hello@synapseos.tech
                </a>
              </div>
            </div>
            <div className="flex gap-4 p-5 rounded-xl" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-edge)' }}>
              <Image src="/team/cofounder.jpg" alt="Nathan David" width={64} height={64} unoptimized className="rounded-lg object-cover shrink-0" />
              <div>
                <p className="font-semibold">Nathan David</p>
                <p className="text-xs mb-2" style={{ color: 'var(--brand-gold)' }}>
                  Co-founder & clinical lead
                </p>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Clinical workflows, scoring tools, and guideline alignment.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Compare */}
      <section id="compare" className="px-6 py-20" style={{ borderBottom: '1px solid var(--border-edge)' }}>
        <div className="max-w-4xl mx-auto">
          <SectionLabel>Comparison</SectionLabel>
          <h2 className="font-display font-bold text-3xl mb-8">SynapseOS vs common alternatives</h2>
          <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid var(--border-edge)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--bg-surface)' }}>
                  <th className="text-left p-3 font-medium" style={{ color: 'var(--text-muted)' }}>
                    Feature
                  </th>
                  <th className="p-3 text-center" style={{ color: 'var(--brand-orange)' }}>
                    SynapseOS
                  </th>
                  <th className="p-3 text-center" style={{ color: 'var(--text-muted)' }}>
                    OpenMRS
                  </th>
                  <th className="p-3 text-center" style={{ color: 'var(--text-muted)' }}>
                    Slade360
                  </th>
                  <th className="p-3 text-center" style={{ color: 'var(--text-muted)' }}>
                    Paper
                  </th>
                </tr>
              </thead>
              <tbody>
                {COMPARE_ROWS.map((row, i) => (
                  <tr key={row.feature} style={{ background: i % 2 ? 'var(--bg-elevated)' : 'var(--bg-base)' }}>
                    <td className="p-3" style={{ color: 'var(--text-secondary)' }}>
                      {row.feature}
                    </td>
                    <td className="p-3 text-center">
                      <CompareCell v={row.synapse} />
                    </td>
                    <td className="p-3 text-center">
                      <CompareCell v={row.openmrs} />
                    </td>
                    <td className="p-3 text-center">
                      <CompareCell v={row.slade} />
                    </td>
                    <td className="p-3 text-center">
                      <CompareCell v={row.paper} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Standards */}
      <section className="px-6 py-16" style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-edge)' }}>
        <div className="max-w-5xl mx-auto">
          <p className="text-xs font-semibold uppercase tracking-wide mb-6 text-center" style={{ color: 'var(--text-muted)' }}>
            Standards & integrations
          </p>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
            {STANDARDS.map((s) => (
              <div key={s.name} className="p-4 rounded-lg" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-edge)' }}>
                <p className="font-semibold text-sm">{s.name}</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  {s.detail}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Security */}
      <section className="px-6 py-20" style={{ borderBottom: '1px solid var(--border-edge)' }}>
        <div className="max-w-5xl mx-auto">
          <SectionLabel>Security</SectionLabel>
          <h2 className="font-display font-bold text-3xl mb-8">How patient data is protected</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {TRUST.map((t) => (
              <div key={t.title} className="p-4 rounded-lg" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)' }}>
                <p className="font-semibold text-sm mb-1">{t.title}</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {t.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-16" style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-edge)' }}>
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-6">
          <div className="p-8 rounded-xl text-center" style={{ border: '1px solid var(--border-orange)' }}>
            <h3 className="font-display font-bold text-xl mb-3">Hospital or clinic</h3>
            <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
              Request pilot access. We respond with scope, timeline, and pricing for your facility.
            </p>
            <Link
              href="/apply"
              className="inline-block text-sm font-semibold px-6 py-3 rounded-lg"
              style={{ background: 'var(--brand-orange)', color: '#07070A' }}
            >
              Apply for pilot
            </Link>
          </div>
          <div className="p-8 rounded-xl text-center" style={{ border: '1px solid var(--border-gold)' }}>
            <h3 className="font-display font-bold text-xl mb-3">Patient app</h3>
            <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
              Android APK and waitlist for facilities not yet on the network.
            </p>
            <Link
              href="/download"
              className="inline-block text-sm font-semibold px-6 py-3 rounded-lg"
              style={{ background: 'var(--brand-gold)', color: '#07070A' }}
            >
              Download page
            </Link>
          </div>
        </div>
      </section>

      {/* Newsletter */}
      <section className="px-6 py-16" style={{ borderBottom: '1px solid var(--border-edge)' }}>
        <div className="max-w-md mx-auto text-center">
          <SectionLabel>Updates</SectionLabel>
          <h2 className="font-display font-bold text-xl mb-2">Product updates</h2>
          <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
            Release notes and pilot openings. Unsubscribe any time.
          </p>
          <NewsletterForm />
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-12">
        <div className="max-w-5xl mx-auto grid md:grid-cols-4 gap-8 mb-10">
          <div>
            <SynapseLogo size="sm" className="mb-3" />
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Synapse Health Technologies Ltd · Kampala, Uganda
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold mb-3" style={{ color: 'var(--text-muted)' }}>
              Product
            </p>
            <ul className="space-y-2 text-xs" style={{ color: 'var(--text-muted)' }}>
              <li>
                <Link href="/docs">Documentation</Link>
              </li>
              <li>
                <Link href="/status">Status</Link>
              </li>
              <li>
                <Link href="/changelog">Changelog</Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold mb-3" style={{ color: 'var(--text-muted)' }}>
              Contact
            </p>
            <ul className="space-y-2 text-xs" style={{ color: 'var(--text-muted)' }}>
              <li>
                <Link href="/apply">Apply</Link>
              </li>
              <li>
                <Link href="/contact">Contact</Link>
              </li>
              <li>
                <a href="mailto:hello@synapseos.tech">hello@synapseos.tech</a>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold mb-3" style={{ color: 'var(--text-muted)' }}>
              Legal
            </p>
            <ul className="space-y-2 text-xs" style={{ color: 'var(--text-muted)' }}>
              <li>
                <Link href="/legal/privacy">Privacy</Link>
              </li>
              <li>
                <Link href="/legal">Terms</Link>
              </li>
            </ul>
          </div>
        </div>
        <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
          © {new Date().getFullYear()} Synapse Health Technologies Ltd
        </p>
      </footer>
    </div>
  )
}
