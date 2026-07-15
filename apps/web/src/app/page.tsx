import Link from 'next/link'
import Image from 'next/image'
import { FeatureTabs } from '../components/landing/FeatureTabs'
import { DemoWidget } from '../components/landing/DemoWidget'
import { NewsletterForm } from '../components/landing/NewsletterForm'
import { LandingHero } from '../components/landing/LandingHero'
import { TrustMarquee } from '../components/landing/TrustMarquee'
import { AudiencePaths } from '../components/landing/AudiencePaths'
import { LandingNav } from '../components/landing/LandingNav'
import { LandingFooter } from '../components/landing/LandingFooter'
import { SectionShell } from '../components/landing/SectionShell'
import { Reveal } from '../components/landing/Reveal'
import { ModuleGrid } from '../components/landing/ModuleGrid'

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

// Must match the active pharm_* rows in subscription_plans (canonical Pharm pricing).
const PHARM_PLANS = [
  {
    slug: 'pharm_monthly',
    name: 'Pharm Monthly',
    price: 'UGX 20,000',
    period: '/month',
    effective: null,
    badge: null,
    description: 'Full product, one flat monthly price.',
  },
  {
    slug: 'pharm_quarterly',
    name: 'Pharm Quarterly',
    price: 'UGX 52,000',
    period: '/quarter',
    effective: '≈ UGX 17,333 per month',
    badge: 'Save UGX 8,000',
    description: 'One payment per quarter.',
  },
  {
    slug: 'pharm_yearly',
    name: 'Pharm Yearly',
    price: 'UGX 200,000',
    period: '/year',
    effective: '≈ UGX 16,667 per month',
    badge: 'Save UGX 40,000',
    description: 'One payment per year.',
  },
]

const PHARM_FEATURES = [
  'POS with printed receipts',
  'FEFO expiry-aware batch inventory',
  'Sales reporting',
  'Staff roles & cashier sessions',
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
  if (v === 'yes') return <span className="font-medium" style={{ color: 'var(--brand-teal)' }}>Yes</span>
  if (v === 'no') return <span className="font-medium" style={{ color: 'var(--text-muted)' }}>No</span>
  return <span className="font-medium" style={{ color: 'var(--brand-gold)' }}>Partial</span>
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

export default function HomePage() {
  return (
    <div className="landing-page" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
      <LandingNav />
      <TrustMarquee />
      <LandingHero />
      <AudiencePaths />

      <SectionShell label="Context" title="Why hospitals need a single clinical record">
        <div className="grid gap-12 lg:grid-cols-2">
          <p className="landing-lead">
            Fragmented paper files, separate billing spreadsheets, and pharmacy stock kept in isolation make
            continuity of care and revenue collection harder. SynapseOS connects encounters, orders, results,
            dispense, and claims in one audit-backed system.
            <span className="mt-4 block text-xs" style={{ color: 'var(--text-muted)' }}>
              Uganda doctor-to-population ratio is well below WHO recommendations (MOH / WHO public data).
            </span>
          </p>
          <div className="space-y-4">
            {[
              { title: 'Continuity', body: 'One patient record across OPD, ward, lab, pharmacy, and billing.' },
              { title: 'Revenue', body: 'Fee schedules, invoicing, and insurer claim submission from signed encounters.' },
              { title: 'Reporting', body: 'DHIS2 exports and SDG-mapped indicators from live clinical data.' },
            ].map((item) => (
              <div key={item.title} className="landing-card">
                <p className="mb-1 text-sm font-semibold">{item.title}</p>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </SectionShell>

      <SectionShell id="products" label="Products" title="Three products on one platform" variant="surface">
        <div className="grid gap-6 lg:grid-cols-3">
          <article className="landing-card-elevated group flex flex-col p-6 transition-all hover:border-orange-500/40" style={{ borderColor: 'rgba(249,115,22,0.2)' }}>
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'rgba(249,115,22,0.12)' }}>
              <span className="text-lg font-bold" style={{ color: 'var(--brand-orange)' }}>H</span>
            </div>
            <p className="mb-1 text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--brand-orange)' }}>
              Hospitals &amp; clinics
            </p>
            <h3 className="font-display mb-3 text-xl font-bold">SynapseOS</h3>
            <p className="mb-5 flex-1 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Web HMIS: encounters, nursing, lab, radiology, theatre, finance, and admin. Each hospital runs on
              its own tenant with role-based access.
            </p>
            <Link href="/apply" className="inline-flex items-center gap-1 text-sm font-semibold transition-opacity group-hover:opacity-80" style={{ color: 'var(--brand-orange)' }}>
              Apply for deployment →
            </Link>
          </article>
          <article className="landing-card-elevated group flex flex-col p-6 transition-all hover:border-teal-500/40" style={{ borderColor: 'rgba(31,166,166,0.2)' }}>
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'rgba(31,166,166,0.12)' }}>
              <span className="text-lg font-bold" style={{ color: 'var(--brand-teal)' }}>P</span>
            </div>
            <p className="mb-1 text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--brand-teal)' }}>Pharmacies</p>
            <h3 className="font-display mb-3 text-xl font-bold">Synapse Pharm</h3>
            <p className="mb-5 flex-1 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Inventory, FEFO batching, POS, supplier orders, and patient refill requests. Hosted at{' '}
              <span className="font-mono text-xs">pharm.synapseos.tech</span> or a custom domain.
            </p>
            <a href="https://pharm.synapseos.tech" className="inline-flex items-center gap-1 text-sm font-semibold transition-opacity group-hover:opacity-80" style={{ color: 'var(--brand-teal)' }}>
              Start free trial →
            </a>
          </article>
          <article className="landing-card-elevated group flex flex-col p-6 transition-all" style={{ borderColor: 'rgba(232,184,75,0.2)' }}>
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'rgba(232,184,75,0.12)' }}>
              <span className="text-lg font-bold" style={{ color: 'var(--brand-gold)' }}>A</span>
            </div>
            <p className="mb-1 text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--brand-gold)' }}>
              Patients
            </p>
            <h3 className="font-display mb-3 text-xl font-bold">Synapse App</h3>
            <p className="mb-5 flex-1 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Android app for appointments, lab results, telemedicine intake, and health bulletins when connected
              to a Synapse-network facility.
            </p>
            <Link href="/download" className="inline-flex items-center gap-1 text-sm font-semibold transition-opacity group-hover:opacity-80" style={{ color: 'var(--brand-gold)' }}>
              Download or join waitlist →
            </Link>
          </article>
        </div>
      </SectionShell>

      <SectionShell
        id="pharm"
        label="Synapse Pharm"
        title="Pharmacy POS with expiry-aware inventory"
        description="POS with printed receipts, FEFO batch inventory, sales reporting, and staff roles — built for Ugandan pharmacies. Register self-serve and start selling the same day. Every plan starts with a 14-day free trial, no card required."
        variant="cool"
      >
        <div className="grid gap-4 lg:grid-cols-3">
          {PHARM_PLANS.map((plan) => (
            <div
              key={plan.slug}
              className="landing-card flex flex-col !p-5"
              style={{
                borderColor: plan.badge ? 'var(--brand-teal)' : undefined,
                boxShadow: plan.badge ? '0 0 0 1px var(--brand-teal), 0 8px 32px rgba(31,166,166,0.14)' : undefined,
              }}
            >
              {plan.badge && (
                <span className="mb-2 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--brand-teal)' }}>
                  <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: 'var(--brand-teal)' }} />
                  {plan.badge}
                </span>
              )}
              <p className="font-bold">{plan.name}</p>
              <p className="font-display my-1 text-xl font-bold">
                {plan.price}
                <span className="ml-1 text-xs font-normal" style={{ color: 'var(--text-muted)' }}>
                  {plan.period}
                </span>
              </p>
              {plan.effective && (
                <p className="font-mono text-xs" style={{ color: 'var(--brand-teal)' }}>
                  {plan.effective}
                </p>
              )}
              <p className="mb-4 mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                {plan.description}
              </p>
              <ul className="mb-4 flex-1 space-y-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                {PHARM_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-1.5">
                    <span className="mt-0.5 shrink-0" style={{ color: 'var(--brand-teal)' }}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <a
                href="https://pharm.synapseos.tech"
                className={`glow-ring text-center text-sm font-semibold py-2.5 rounded-lg ${plan.badge ? 'landing-btn-primary !w-full' : 'landing-btn-secondary !w-full'}`}
              >
                Start free trial
              </a>
            </div>
          ))}
        </div>
        <p className="mt-6 text-xs" style={{ color: 'var(--text-muted)' }}>
          Same product on every plan — quarterly and yearly only change how often you pay. Sign in or register at{' '}
          <a href="https://pharm.synapseos.tech" className="font-mono underline underline-offset-2" style={{ color: 'var(--brand-teal)' }}>
            pharm.synapseos.tech
          </a>
          .
        </p>
      </SectionShell>

      <SectionShell id="deploy" label="Deployment" title="How a hospital goes live" tight>
        <ol className="landing-timeline">
          {DEPLOY_STEPS.map((step, i) => (
            <li key={step.title} className="landing-timeline-step">
              <span className="landing-timeline-badge">{i + 1}</span>
              <p className="landing-timeline-eyebrow">
                Step {i + 1} of {DEPLOY_STEPS.length}
              </p>
              <p className="landing-timeline-title">{step.title}</p>
              <p className="landing-timeline-body">{step.body}</p>
            </li>
          ))}
        </ol>
      </SectionShell>

      <SectionShell
        id="features"
        label="Capabilities"
        title="What the platform includes"
        description="Select an area to see implemented workflows. AI features require clinician review before clinical decisions."
        variant="surface"
      >
        <FeatureTabs />
      </SectionShell>

      <SectionShell
        id="modules"
        label="Modules"
        title="Department modules"
        description="Enable only the modules your facility needs. Each module ships with role permissions and department-specific forms."
      >
        <ModuleGrid modules={MODULES} />
      </SectionShell>

      <SectionShell label="Reporting" title="National and donor reporting" variant="surface" tight>
        <div className="grid items-start gap-10 lg:grid-cols-2">
          <p className="landing-lead">
            Encounters, outcomes, and programme indicators can be mapped to SDG goals and exported for DHIS2.
            Facilities configure which indicators apply; exports run on a schedule with anonymisation rules, not
            sample dashboard percentages.
          </p>
          <ul className="space-y-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
            {[
              'Nightly DHIS2-compatible export pipeline (tenant-configured)',
              'SDG command centre: drill-down from aggregate goals to underlying encounters',
              'MPDSR and surveillance hooks for maternal death and outbreak signals',
            ].map((item) => (
              <li key={item} className="landing-card-elevated p-4">
                {item}
              </li>
            ))}
          </ul>
        </div>
      </SectionShell>

      <SectionShell
        id="pricing"
        label="Pricing"
        title="Plans (UGX)"
        description="Prices shown on the marketing site; confirm current rates with sales before procurement."
        variant="warm"
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TIERS.map((tier) => (
            <div
              key={tier.name}
              className={`flex flex-col !p-5 ${tier.highlight ? 'landing-card relative overflow-hidden' : 'landing-card'}`}
              style={{
                borderColor: tier.highlight ? 'var(--brand-orange)' : undefined,
                boxShadow: tier.highlight ? '0 0 0 1px var(--brand-orange), 0 8px 32px rgba(249,115,22,0.18)' : undefined,
              }}
            >
              {tier.highlight && (
                <div
                  aria-hidden
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'radial-gradient(ellipse 80% 60% at 50% -20%, rgba(249,115,22,0.12) 0%, transparent 70%)',
                    pointerEvents: 'none',
                  }}
                />
              )}
              {tier.badge && (
                <span className="mb-2 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--brand-orange)' }}>
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-orange-500" />
                  {tier.badge}
                </span>
              )}
              <p className="font-bold">{tier.name}</p>
              <p className="font-display my-1 text-xl font-bold">
                {tier.price}
                <span className="ml-1 text-xs font-normal" style={{ color: 'var(--text-muted)' }}>
                  {tier.period}
                </span>
              </p>
              <p className="mb-4 text-xs" style={{ color: 'var(--text-muted)' }}>
                {tier.description}
              </p>
              <ul className="mb-4 flex-1 space-y-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-1.5">
                    <span className="mt-0.5 shrink-0" style={{ color: 'var(--brand-teal)' }}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href={tier.ctaHref}
                className={`glow-ring text-center text-sm font-semibold py-2.5 rounded-lg ${tier.highlight ? 'landing-btn-primary !w-full' : 'landing-btn-secondary !w-full'}`}
              >
                {tier.cta}
              </Link>
            </div>
          ))}
        </div>
      </SectionShell>

      <SectionShell id="demo" label="Demo" title="Try the diagnosis assistant" variant="surface">
        <p className="landing-lead mb-8 max-w-2xl">
          Enter symptoms below. This demo calls the same API used in development; results are for illustration
          and not a substitute for clinical judgement.
        </p>
        <div className="max-w-3xl">
          <DemoWidget />
        </div>
      </SectionShell>

      <SectionShell id="pilot" label="Pilot programme" title="What hospitals evaluate in a pilot" tight>
        <p className="landing-lead mb-8 max-w-2xl">
          We do not publish anonymous quotes or unaudited performance percentages on this page. During pilot,
          facilities measure outcomes that matter to them, typically documentation time, claim turnaround, stock
          accuracy, and staff adoption.
        </p>
        <div className="grid gap-4 text-sm md:grid-cols-3">
          {[
            'Workflow fit per department (OPD, ward, lab, pharmacy)',
            'Data migration from spreadsheets or legacy exports',
            'Staff training and role assignment',
            'Insurance claim submission and rejection handling',
            'Offline behaviour on your network',
            'Export to DHIS2 / internal dashboards',
          ].map((item) => (
            <div key={item} className="landing-card">
              {item}
            </div>
          ))}
        </div>
        <Link href="/apply" className="mt-8 inline-block text-sm font-semibold" style={{ color: 'var(--brand-orange)' }}>
          Submit a pilot application →
        </Link>
      </SectionShell>

      <SectionShell label="Team" title="People building SynapseOS" variant="surface" tight>
        <div className="grid gap-6 md:grid-cols-2 max-w-3xl">
          <div className="landing-card-elevated flex gap-4 p-5">
            <Image src="/team/founder.jpg" alt="Ebrine Tushabe" width={64} height={64} unoptimized className="shrink-0 rounded-lg object-cover" />
            <div>
              <p className="font-semibold">Ebrine Tushabe</p>
              <p className="mb-2 text-xs" style={{ color: 'var(--brand-orange)' }}>
                Founder & CEO
              </p>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Product engineering and hospital deployments.
              </p>
              <Link href="/contact" className="mt-2 inline-block text-xs" style={{ color: 'var(--brand-orange)' }}>
                Get in touch →
              </Link>
            </div>
          </div>
          <div className="landing-card-elevated flex gap-4 p-5">
            <Image src="/team/cofounder.jpg" alt="Nathan David" width={64} height={64} unoptimized className="shrink-0 rounded-lg object-cover" />
            <div>
              <p className="font-semibold">Nathan David</p>
              <p className="mb-2 text-xs" style={{ color: 'var(--brand-gold)' }}>
                Co-founder & clinical lead
              </p>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Clinical workflows, scoring tools, and guideline alignment.
              </p>
            </div>
          </div>
        </div>
      </SectionShell>

      <SectionShell id="compare" label="Comparison" title="SynapseOS vs common alternatives">
        <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid var(--border-edge)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--bg-surface)' }}>
                <th className="p-3 text-left font-medium" style={{ color: 'var(--text-muted)' }}>
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
      </SectionShell>

      <SectionShell label="Standards" title="Standards & integrations" variant="surface" tight>
        <div className="landing-plain-list">
          {STANDARDS.map((s) => (
            <div key={s.name} className="landing-plain-item">
              <span className="landing-plain-dot" style={{ background: 'var(--brand-orange)' }} aria-hidden />
              <div>
                <p>{s.name}</p>
                <p>{s.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </SectionShell>

      <SectionShell label="Security" title="How patient data is protected" variant="cool" tight>
        <div className="landing-plain-list">
          {TRUST.map((t) => (
            <div key={t.title} className="landing-plain-item">
              <span className="landing-plain-dot" style={{ background: 'var(--brand-teal)' }} aria-hidden />
              <div>
                <p>{t.title}</p>
                <p>{t.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </SectionShell>

      <section className="landing-section landing-section-surface">
        <Reveal className="landing-container grid gap-6 md:grid-cols-2">
          <div
            className="landing-card-elevated p-8 text-center transition-all hover:shadow-lg"
            style={{
              borderColor: 'var(--border-orange)',
              background: 'linear-gradient(135deg, var(--bg-elevated) 0%, rgba(249,115,22,0.04) 100%)',
            }}
          >
            <div className="mb-4 flex justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: 'rgba(249,115,22,0.12)' }}>
                <span className="text-xl font-bold" style={{ color: 'var(--brand-orange)' }}>H</span>
              </div>
            </div>
            <h3 className="font-display mb-3 text-xl font-bold">Hospital or clinic</h3>
            <p className="mb-6 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Request pilot access. We respond with scope, timeline, and pricing for your facility.
            </p>
            <Link href="/apply" className="landing-btn-primary glow-ring inline-flex items-center gap-2 px-6 py-3">
              Apply for pilot
            </Link>
          </div>
          <div
            className="landing-card-elevated p-8 text-center transition-all hover:shadow-lg"
            style={{
              borderColor: 'var(--border-gold)',
              background: 'linear-gradient(135deg, var(--bg-elevated) 0%, rgba(232,184,75,0.04) 100%)',
            }}
          >
            <div className="mb-4 flex justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: 'rgba(232,184,75,0.12)' }}>
                <span className="text-xl font-bold" style={{ color: 'var(--brand-gold)' }}>A</span>
              </div>
            </div>
            <h3 className="font-display mb-3 text-xl font-bold">Patient app</h3>
            <p className="mb-6 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Android APK and waitlist for facilities not yet on the network.
            </p>
            <Link href="/download" className="landing-btn-secondary inline-flex items-center gap-2 px-6 py-3">
              Download page
            </Link>
          </div>
        </Reveal>
      </section>

      <section className="landing-section">
        <Reveal className="landing-container max-w-md text-center">
          <p className="section-label mx-auto">Updates</p>
          <h2 className="landing-heading mb-2">Product updates</h2>
          <p className="landing-lead mb-6">Release notes and pilot openings. Unsubscribe any time.</p>
          <NewsletterForm />
        </Reveal>
      </section>

      <LandingFooter />
    </div>
  )
}
