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
import { ArchitectureVisual, ConnectedJourney, DeploymentModes, ProductPlatformSplit } from '../components/landing/PlatformStory'
import { COMPARISON_MATRIX } from '@synapse/config/comparison'
import type { ComparisonCell } from '@synapse/config/gates'
import { INTEGRATIONS } from '@synapse/config/manifest'
import { Eyebrow, LeadText, SectionHeading } from '../components/typography'

import { COMPANY, PUBLIC_CONTACT_EMAIL } from '@synapse/config/company'
import {
  CANONICAL_PLAN_SLUGS,
  FALLBACK_PUBLIC_PLANS,
  findPlanBySlug,
  formatUgxAnnual,
} from '@synapse/db/commercial-pricing'

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

const HOME_PLANS = [
  findPlanBySlug(FALLBACK_PUBLIC_PLANS, CANONICAL_PLAN_SLUGS.pharmacy)!,
  findPlanBySlug(FALLBACK_PUBLIC_PLANS, CANONICAL_PLAN_SLUGS.lab)!,
  findPlanBySlug(FALLBACK_PUBLIC_PLANS, CANONICAL_PLAN_SLUGS.osBasic)!,
  findPlanBySlug(FALLBACK_PUBLIC_PLANS, CANONICAL_PLAN_SLUGS.enterprise)!,
]

const PHARM_FEATURES = [
  'POS with printed receipts',
  'FEFO expiry-aware batch inventory',
  'Purchasing & goods receipt',
  'Sales reporting',
  'Staff roles & cashier sessions',
]

type Cell = ComparisonCell

function CompareCell({ v }: { v: Cell }) {
  if (v === 'yes') return <span className="font-medium" style={{ color: 'var(--brand-teal)' }}>Yes</span>
  if (v === 'no') return <span className="font-medium" style={{ color: 'var(--text-muted)' }}>No</span>
  return <span className="font-medium" style={{ color: 'var(--brand-gold)' }}>Partial</span>
}

const STANDARDS = INTEGRATIONS.filter((item) =>
  ['fhir-r4', 'icd-11', 'dhis2', 'hl7-astm'].includes(item.id),
).map((item) => ({
  name: item.name,
  detail: `${item.status.toUpperCase()} — ${item.summary}`,
}))

const TRUST = [
  { title: 'Row-level security', desc: 'Tenant isolation on clinical tables via Postgres RLS' },
  { title: 'Audit trail', desc: 'Actor, timestamp, and action logged for sensitive operations' },
  { title: 'TLS in transit', desc: 'HTTPS for web, API, and admin surfaces' },
  { title: 'Offline-capable', desc: 'Durable offline checkout is not claimed. Edge architecture is documented as roadmap.' },
  { title: 'Role-based access', desc: 'Doctor, nurse, pharmacist, billing, and admin roles' },
  { title: 'Session revocation', desc: 'Password reset and logout invalidate server-side sessions' },
]

export default function HomePage() {
  return (
    <div className="landing-page" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
      <LandingNav />
      <TrustMarquee />
      <LandingHero />
      <SectionShell id="platform" label="One system" title="From registration to follow-up without restarting the story">
        <ConnectedJourney />
      </SectionShell>
      <SectionShell label="Architecture" title="Products on a shared kernel" variant="surface">
        <ArchitectureVisual />
      </SectionShell>
      <SectionShell label="Deploy" title="Native, overlay, or network">
        <DeploymentModes />
      </SectionShell>
      <SectionShell label="Truth" title="Products versus platform capabilities">
        <ProductPlatformSplit />
      </SectionShell>
      <AudiencePaths />

      <SectionShell label="Context" title="Why hospitals need a single clinical record">
        <div className="grid gap-12 lg:grid-cols-2">
          <LeadText>
            Fragmented paper files, separate billing spreadsheets, and pharmacy stock kept in isolation make
            continuity of care and revenue collection harder. SynapseOS connects encounters, orders, results,
            dispense, and claims in one audit-backed system.
            <span className="mt-4 block text-xs" style={{ color: 'var(--text-muted)' }}>
              Uganda doctor-to-population ratio is well below WHO recommendations (MOH / WHO public data).
            </span>
          </LeadText>
          <div className="space-y-4">
            {[
              { title: 'Continuity', body: 'One person identity across OPD, laboratory, pharmacy, and follow-up — when those modules are actually connected.' },
              { title: 'Revenue', body: 'Pharmacy POS is the deepest commercial workflow. Hospital charge capture remains partial.' },
              { title: 'Reporting', body: 'Public-health and DHIS2 exports are roadmap. We do not invent national coverage numbers.' },
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
            <Eyebrow className="mb-1" style={{ color: 'var(--brand-orange)' }}>
              Hospitals &amp; clinics
            </Eyebrow>
            <SectionHeading as="h3" level={3} className="mb-3">
              SynapseOS
            </SectionHeading>
            <p className="mb-5 flex-1 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Facility care delivery. Registration and OPD triage exist today; specialty modules are being completed through connected journeys rather than empty screens.
            </p>
            <Link href="/apply" className="inline-flex items-center gap-1 text-sm font-semibold transition-opacity group-hover:opacity-80" style={{ color: 'var(--brand-orange)' }}>
              Apply for deployment →
            </Link>
          </article>
          <article className="landing-card-elevated group flex flex-col p-6 transition-all hover:border-teal-500/40" style={{ borderColor: 'rgba(31,166,166,0.2)' }}>
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'rgba(31,166,166,0.12)' }}>
              <span className="text-lg font-bold" style={{ color: 'var(--brand-teal)' }}>P</span>
            </div>
            <Eyebrow className="mb-1" style={{ color: 'var(--brand-teal)' }}>
              Pharmacies
            </Eyebrow>
            <SectionHeading as="h3" level={3} className="mb-3">
              Synapse Pharm
            </SectionHeading>
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
            <Eyebrow className="mb-1" style={{ color: 'var(--brand-gold)' }}>
              Patients
            </Eyebrow>
            <SectionHeading as="h3" level={3} className="mb-3">
              Synapse App
            </SectionHeading>
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
        label="Synapse Pharmacy"
        title="Pharmacy operations for community pharmacies"
        description="Inventory, purchasing, dispensing, POS/billing, batch/expiry tracking, and reports — with mobile access where production-supported."
        variant="cool"
      >
        <div className="landing-card flex max-w-xl flex-col !p-6">
          <p className="font-bold">SYNAPSE Pharmacy</p>
          <p className="font-display my-2 text-heading-2 tabular-nums tracking-tight">
            {formatUgxAnnual(
              findPlanBySlug(FALLBACK_PUBLIC_PLANS, CANONICAL_PLAN_SLUGS.pharmacy)!.priceUgx,
              'PUBLIC_FIXED',
            )}
          </p>
          <ul className="mb-4 space-y-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
            {PHARM_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-1.5">
                <span className="mt-0.5 shrink-0" style={{ color: 'var(--brand-teal)' }}>
                  ✓
                </span>
                {f}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <Link href="/products/pharmacy" className="landing-btn-primary">
              Product details
            </Link>
            <a href={COMPANY.domains.pharmacy} className="landing-btn-secondary">
              Open Pharmacy app
            </a>
          </div>
        </div>
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
        id="lab-pathways"
        label="Diagnostics & pathways"
        title="Synapse Lab and clinician-controlled pathways"
        variant="cool"
      >
        <div className="grid gap-6 lg:grid-cols-2">
          <article className="landing-card !p-6">
            <p className="text-xs uppercase tracking-widest" style={{ color: 'var(--brand-teal)' }}>Synapse Lab</p>
            <h3 className="mt-2 font-display text-heading-3">Order → Specimen → Verify → Record</h3>
            <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
              The first complete laboratory slice is in development. AI does not release results. SYNAPSE is designed
              to work with national LIS/LIMS efforts such as ALIS — it does not claim to replace them.
            </p>
          </article>
          <article className="landing-card !p-6">
            <p className="text-xs uppercase tracking-widest" style={{ color: 'var(--brand-gold)' }}>Synapse Pathways</p>
            <h3 className="mt-2 font-display text-heading-3">Guideline → Pathway → Care plan</h3>
            <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
              The first demo pathway is adult suspected sepsis. Clinicians can override every recommendation. Overrides
              are learning data only after governance — they never silently retrain clinical AI.
            </p>
          </article>
        </div>
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
          <LeadText>
            Encounters, outcomes, and programme indicators can be mapped to SDG goals and exported for DHIS2.
            Facilities configure which indicators apply; exports run on a schedule with anonymisation rules, not
            sample dashboard percentages.
          </LeadText>
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
        title="Annual plans (UGX)"
        description="Canonical commercial pricing — edited in Platform Admin, not hard-coded across the site."
        variant="warm"
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {HOME_PLANS.map((plan) => (
            <div key={plan.slug} className="landing-card flex flex-col !p-5">
              <p className="font-bold">{plan.name}</p>
              <p className="font-display my-2 text-heading-3 tabular-nums tracking-tight">
                {formatUgxAnnual(plan.priceUgx, plan.pricingState)}
              </p>
              <p className="mb-4 flex-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                {plan.description}
              </p>
              <Link
                href={plan.ctaHref || '/pricing'}
                className="landing-btn-secondary !w-full text-center text-sm font-semibold"
              >
                {plan.ctaLabel || 'Learn more'}
              </Link>
            </div>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/pricing" className="landing-btn-primary">
            Full pricing
          </Link>
          <Link href="/book-meeting" className="landing-btn-secondary">
            Book a Meeting
          </Link>
          <a href={`mailto:${PUBLIC_CONTACT_EMAIL}`} className="landing-btn-secondary">
            {PUBLIC_CONTACT_EMAIL}
          </a>
        </div>
      </SectionShell>

      <SectionShell id="demo" label="Demo" title="Try the diagnosis assistant" variant="surface">
        <LeadText className="mb-8 max-w-2xl">
          Enter symptoms below. This demo calls the same API used in development; results are for illustration
          and not a substitute for clinical judgement.
        </LeadText>
        <div className="max-w-3xl">
          <DemoWidget />
        </div>
      </SectionShell>

      <SectionShell id="pilot" label="Pilot programme" title="What hospitals evaluate in a pilot" tight>
        <LeadText className="mb-8 max-w-2xl">
          We do not publish anonymous quotes or unaudited performance percentages on this page. During pilot,
          facilities measure outcomes that matter to them, typically documentation time, claim turnaround, stock
          accuracy, and staff adoption.
        </LeadText>
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
        <LeadText className="mb-8 max-w-2xl">
          Synapse cells are computed from capability gates. A cell cannot become Yes because someone edited this page.
          Live evidence is still required before GREEN.
        </LeadText>
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
              {COMPARISON_MATRIX.map((row, i) => (
                <tr key={row.id} style={{ background: i % 2 ? 'var(--bg-elevated)' : 'var(--bg-base)' }}>
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
            <SectionHeading as="h3" level={3} className="mb-3">
              Hospital or clinic
            </SectionHeading>
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
            <SectionHeading as="h3" level={3} className="mb-3">
              Patient app
            </SectionHeading>
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
          <Eyebrow variant="section" className="mx-auto">
            Updates
          </Eyebrow>
          <SectionHeading level={2} className="mb-2">
            Product updates
          </SectionHeading>
          <LeadText className="mb-6">Release notes and pilot openings. Unsubscribe any time.</LeadText>
          <NewsletterForm />
        </Reveal>
      </section>

      <LandingFooter />
    </div>
  )
}
