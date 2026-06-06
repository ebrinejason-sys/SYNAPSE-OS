import Link from 'next/link'
import Image from 'next/image'
import { SynapseLogo } from '../components/SynapseLogo'
import { FeatureTabs }    from '../components/landing/FeatureTabs'
import { DemoWidget }     from '../components/landing/DemoWidget'
import { NewsletterForm } from '../components/landing/NewsletterForm'

/* ─── Kente geometric SVG background (inline, pointer-events:none) ─────── */
function KenteBackground({ opacity = 0.045 }: { opacity?: number }) {
  return (
    <svg
      aria-hidden
      style={{
        position: 'absolute', inset: 0, width: '100%', height: '100%',
        pointerEvents: 'none', opacity,
      }}
    >
      <defs>
        <pattern id="kente" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
          {/* Outer diamond */}
          <polygon points="40,4 76,40 40,76 4,40"
            fill="none" stroke="#E8B84B" strokeWidth="0.8" />
          {/* Inner diamond */}
          <polygon points="40,18 62,40 40,62 18,40"
            fill="none" stroke="#F97316" strokeWidth="0.6" />
          {/* Corner squares */}
          <rect x="0"  y="0"  width="12" height="12" fill="none" stroke="#E8B84B" strokeWidth="0.5" />
          <rect x="68" y="0"  width="12" height="12" fill="none" stroke="#E8B84B" strokeWidth="0.5" />
          <rect x="0"  y="68" width="12" height="12" fill="none" stroke="#E8B84B" strokeWidth="0.5" />
          <rect x="68" y="68" width="12" height="12" fill="none" stroke="#E8B84B" strokeWidth="0.5" />
          {/* Center dot */}
          <circle cx="40" cy="40" r="2.5" fill="#F97316" />
          {/* Cross lines */}
          <line x1="40" y1="0" x2="40" y2="80" stroke="#E8B84B" strokeWidth="0.3" strokeDasharray="2,6" />
          <line x1="0" y1="40" x2="80" y2="40" stroke="#E8B84B" strokeWidth="0.3" strokeDasharray="2,6" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#kente)" />
    </svg>
  )
}

/* ─── Reusable section label ────────────────────────────────────────────── */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="section-label">
      <span style={{
        display: 'inline-block', width: '1.5rem', height: '2px',
        background: 'var(--brand-gold)', borderRadius: '1px',
      }} />
      {children}
    </p>
  )
}

/* ─── Metrics marquee data ──────────────────────────────────────────────── */
const METRICS = [
  { val: '150+',        label: 'Clinical Scoring Tools' },
  { val: '20+',         label: 'Departments Supported'   },
  { val: '4.2s',        label: 'AI Diagnosis Response'   },
  { val: 'FHIR R4',     label: 'Compliant'                },
  { val: '84%',         label: 'AI Concordance'           },
  { val: 'ICD-11',      label: 'Coded Output'             },
  { val: 'Offline-First', label: 'Works Without Internet' },
  { val: '99.97%',      label: 'Platform Uptime'          },
  { val: 'Uganda UCG',  label: 'Guidelines Grounded'      },
  { val: '120+ Tables', label: 'Clinical Data Model'      },
]

/* ─── Department modules ────────────────────────────────────────────────── */
const MODULES = [
  { abbr: 'OPD', name: 'OPD / Consultation',  desc: 'Outpatient queue, consultation workflow, fee schedules' },
  { abbr: 'A&E', name: 'Emergency A&E',        desc: 'Triage board (ESI), START algorithm, resuscitation records' },
  { abbr: 'MAT', name: 'Maternity',            desc: 'ANC tracker, partograph, delivery records, PMTCT, MPDSR' },
  { abbr: 'PAE', name: 'Paediatrics',          desc: 'WHO growth charts, immunisation scheduler, CMAM, MUAC' },
  { abbr: 'HIV', name: 'HIV / ART',            desc: 'Client enrolment, ART regimen management, viral load tracking' },
  { abbr: 'ICU', name: 'ICU',                  desc: 'Hourly flowsheets, SOFA/APACHE II, sepsis bundle, ventilator' },
  { abbr: 'THR', name: 'Surgery / Theatre',    desc: 'WHO SSC 3-phase checklist, intra-op records, PACU' },
  { abbr: 'CDO', name: 'Cardiology',           desc: 'AI ECG interpretation, TIMI/GRACE/CHA₂DS₂-VASc scores' },
  { abbr: 'ONC', name: 'Oncology',             desc: 'TNM staging, chemo protocols, BSA dosing, CTCAE toxicity' },
  { abbr: 'MHU', name: 'Mental Health',        desc: 'PHQ-9, GAD-7, C-SSRS, risk assessment, safety planning' },
  { abbr: 'REN', name: 'Renal / Dialysis',     desc: 'Dialysis session records, CKD staging, renal function trends' },
  { abbr: 'CHM', name: 'Care Home',            desc: 'Care plans, Barthel Index, Waterlow/Braden, falls risk' },
  { abbr: 'CHW', name: 'Community Health',     desc: 'CHW mobile (offline), household surveys, contact tracing' },
  { abbr: 'TCH', name: 'Teaching Hospital',    desc: 'Ward round mode, AI pre-round summaries, M&M conferences' },
  { abbr: 'LAB', name: 'Laboratory',           desc: 'Orders queue, results entry, QC, AI interpretation' },
  { abbr: 'PHM', name: 'Pharmacy',             desc: 'FEFO dispense, POS, drug interactions, inventory' },
  { abbr: 'RAD', name: 'Radiology',            desc: 'DICOM viewer, AI preliminary reads, PACS integration' },
  { abbr: 'FIN', name: 'Finance',              desc: 'Fee schedules, invoicing, mobile money, insurance claims' },
  { abbr: 'REC', name: 'Reception',            desc: 'Registration, appointments, triage queue, visitor log' },
  { abbr: 'TEL', name: 'Telemedicine',         desc: '13-step chatbot → video consult → AI SOAP note' },
]

/* ─── SDG goals ─────────────────────────────────────────────────────────── */
const SDGS = [
  { n: 1,  label: 'No Poverty',            color: '#E5243B', pct: 42 },
  { n: 2,  label: 'Zero Hunger',           color: '#DDA63A', pct: 38 },
  { n: 3,  label: 'Good Health',           color: '#4C9F38', pct: 87 },
  { n: 4,  label: 'Quality Education',     color: '#C5192D', pct: 29 },
  { n: 5,  label: 'Gender Equality',       color: '#FF3A21', pct: 56 },
  { n: 6,  label: 'Clean Water',           color: '#26BDE2', pct: 61 },
  { n: 7,  label: 'Affordable Energy',     color: '#FCC30B', pct: 33 },
  { n: 8,  label: 'Economic Growth',       color: '#A21942', pct: 44 },
  { n: 9,  label: 'Innovation',            color: '#FD6925', pct: 52 },
  { n: 10, label: 'Reduced Inequalities',  color: '#DD1367', pct: 48 },
  { n: 11, label: 'Sustainable Cities',    color: '#FD9D24', pct: 39 },
  { n: 12, label: 'Responsible Use',       color: '#BF8B2E', pct: 31 },
  { n: 13, label: 'Climate Action',        color: '#3F7E44', pct: 27 },
  { n: 14, label: 'Life Below Water',      color: '#0A97D9', pct: 18 },
  { n: 15, label: 'Life on Land',          color: '#56C02B', pct: 22 },
  { n: 16, label: 'Peace & Justice',       color: '#00689D', pct: 63 },
  { n: 17, label: 'Partnerships',          color: '#19486A', pct: 71 },
]

/* ─── Pricing tiers ─────────────────────────────────────────────────────── */
const TIERS = [
  {
    name: 'Trial',
    price: 'Free',
    period: '30 days',
    description: 'Try the full platform risk-free.',
    highlight: false,
    badge: null,
    features: [
      '1 department',
      'Up to 10 staff',
      'Basic AI diagnosis',
      'Community support',
      'No insurance copilot',
    ],
    cta: 'Start Trial',
    ctaHref: '/signup?plan=trial',
  },
  {
    name: 'Starter',
    price: 'UGX 250,000',
    period: '/month',
    description: 'For small clinics and health centres.',
    highlight: false,
    badge: null,
    features: [
      '3 departments',
      'Up to 25 staff',
      'Full AI diagnosis',
      'Basic insurance copilot',
      'Email support',
    ],
    cta: 'Subscribe',
    ctaHref: '/signup?plan=starter',
  },
  {
    name: 'Professional',
    price: 'UGX 750,000',
    period: '/month',
    description: 'For hospitals with multiple departments.',
    highlight: true,
    badge: 'Most Popular',
    features: [
      'All departments',
      'Up to 100 staff',
      'Full AI + RAG (UCG)',
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
    description: 'For large hospitals and hospital networks.',
    highlight: false,
    badge: null,
    features: [
      'Unlimited departments',
      'Unlimited staff',
      'Full AI + RAG',
      'Dedicated CSM',
      'On-prem option',
      'SLA 99.9%',
      'SAML / SSO',
    ],
    cta: 'Contact Sales',
    ctaHref: '/contact?intent=enterprise',
  },
]

/* ─── Comparison table data ──────────────────────────────────────────────── */
type Cell = '✓' | '✗' | '~'
const COMPARE_ROWS: { feature: string; synapse: Cell; openmrs: Cell; slade: Cell; paper: Cell }[] = [
  { feature: 'AI Differential Diagnosis', synapse: '✓', openmrs: '✗', slade: '✗', paper: '✗' },
  { feature: 'Offline-First Operation',   synapse: '✓', openmrs: '~', slade: '✗', paper: '✓' },
  { feature: 'FHIR R4 Compliant',         synapse: '✓', openmrs: '✓', slade: '~', paper: '✗' },
  { feature: 'Insurance Copilot',         synapse: '✓', openmrs: '✗', slade: '~', paper: '✗' },
  { feature: 'ICD-11 Coded',              synapse: '✓', openmrs: '~', slade: '~', paper: '✗' },
  { feature: 'Uganda Clinical Guidelines', synapse: '✓', openmrs: '✗', slade: '✓', paper: '✗' },
  { feature: 'Mobile Patient App',        synapse: '✓', openmrs: '✗', slade: '✗', paper: '✗' },
  { feature: '20+ Departments',           synapse: '✓', openmrs: '~', slade: '✓', paper: '✗' },
  { feature: 'SDG Dashboard',             synapse: '✓', openmrs: '✗', slade: '✗', paper: '✗' },
  { feature: 'Pharmacy POS',              synapse: '✓', openmrs: '✗', slade: '✓', paper: '✗' },
]

function CellIcon({ v }: { v: Cell }) {
  if (v === '✓') return <span style={{ color: '#22C55E', fontWeight: 700 }}>✓</span>
  if (v === '✗') return <span style={{ color: '#EF4444', fontWeight: 700 }}>✗</span>
  return <span style={{ color: '#EAB308', fontWeight: 700 }}>~</span>
}

/* ─── Partners / integrations ────────────────────────────────────────────── */
const PARTNERS = [
  { name: 'FHIR R4',      sub: 'Interoperability'  },
  { name: 'ICD-11',       sub: 'Classification'     },
  { name: 'DHIS2',        sub: 'National Reporting' },
  { name: 'Gemini AI',    sub: 'Google DeepMind'    },
  { name: 'HL7',          sub: 'Messaging Standard' },
  { name: 'Uganda MOH',   sub: 'Ministry of Health' },
  { name: 'OpenFDA',      sub: 'Drug Safety'        },
  { name: 'MedGemma',     sub: 'Medical AI'         },
]

/* ─── Security trust items ───────────────────────────────────────────────── */
const TRUST = [
  { abbr: 'DPPA', title: 'DPPA 2019 Compliant',  desc: 'Uganda Data Protection and Privacy Act' },
  { abbr: 'RLS',  title: 'Row-Level Security',    desc: 'RLS enforced on all 120+ database tables' },
  { abbr: 'TLS',  title: 'TLS Everywhere',        desc: 'All data encrypted in transit' },
  { abbr: 'LOG',  title: 'Full Audit Trail',      desc: 'Every action logged with actor + timestamp' },
  { abbr: 'FHIR', title: 'FHIR R4 Certified',    desc: 'Open interoperability standard' },
  { abbr: 'OFF',  title: 'Offline Capable',       desc: 'Works during internet and power outages' },
]

/* ═══════════════════════════════════════════════════════════════════════════
   PAGE
   ═══════════════════════════════════════════════════════════════════════════ */
export default function HomePage() {
  return (
    <div style={{ background: 'var(--bg-base)', color: 'var(--text-primary)', overflowX: 'hidden' }}>

      {/* ── NAV ─────────────────────────────────────────────────────────── */}
      <nav
        className="sticky top-0 z-50 flex items-center justify-between px-6 py-3.5"
        style={{
          background: 'rgba(7,7,10,0.85)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <SynapseLogo size="md" />
        <div className="hidden md:flex items-center gap-7">
          {[
            ['#features',  'Features'],
            ['#modules',   'Modules'],
            ['#pricing',   'Pricing'],
            ['#demo',      'Demo'],
            ['/about',     'About'],
          ].map(([href, label]) => (
            <a key={label} href={href}
               className="text-sm transition-colors hover:text-white"
               style={{ color: 'var(--text-secondary)' }}>
              {label}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login"
                className="text-sm font-medium transition-colors hover:text-white"
                style={{ color: 'var(--text-secondary)' }}>
            Sign In
          </Link>
          <Link href="/apply"
                className="text-sm font-bold px-4 py-2 rounded-xl transition-all pulse-glow"
                style={{ background: 'var(--brand-orange)', color: '#07070A' }}>
            Apply for Access
          </Link>
        </div>
      </nav>

      {/* ── §1 HERO ─────────────────────────────────────────────────────── */}
      <section
        id="hero"
        className="relative flex flex-col items-center justify-center text-center px-6"
        style={{ minHeight: '96vh', paddingTop: '6rem', paddingBottom: '4rem', overflow: 'hidden' }}
      >
        {/* Kente background */}
        <KenteBackground opacity={0.05} />

        {/* Radial glow */}
        <div style={{
          position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
          width: '60vw', height: '60vh',
          background: 'radial-gradient(ellipse at top, rgba(249,115,22,0.18) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        {/* Secondary gold glow */}
        <div style={{
          position: 'absolute', bottom: '10%', right: '10%',
          width: '30vw', height: '30vh',
          background: 'radial-gradient(ellipse, rgba(232,184,75,0.07) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div style={{ position: 'relative', zIndex: 1, maxWidth: '56rem' }}>
          {/* Eyebrow badge */}
          <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-8 text-xs font-bold animate-fadeInUp"
            style={{
              background: 'rgba(232,184,75,0.1)',
              border: '1px solid var(--border-gold)',
              color: 'var(--brand-gold)',
              letterSpacing: '0.06em',
            }}
          >
            Built in Uganda · Powered by Gemini AI · Open to Africa
          </div>

          {/* Main headline */}
          <h1
            className="font-display font-bold animate-fadeInUp delay-100"
            style={{
              fontSize: 'clamp(2.8rem, 6vw, 5rem)',
              lineHeight: 1.05,
              letterSpacing: '-0.02em',
              marginBottom: '1.5rem',
              opacity: 0,
            }}
          >
            The Operating System<br />
            for{' '}
            <span className="shimmer-text">African Healthcare.</span>
          </h1>

          {/* Subheadline */}
          <p
            className="animate-fadeInUp delay-200"
            style={{
              fontSize: 'clamp(1rem, 2vw, 1.25rem)',
              color: 'var(--text-secondary)',
              lineHeight: 1.7,
              maxWidth: '44rem',
              margin: '0 auto 2.5rem',
              opacity: 0,
            }}
          >
            AI-powered HMIS for every department, every workflow, every ward.
            Offline-first. FHIR R4 compliant. Grounded in Uganda Clinical Guidelines.
            Built for hospitals that can&apos;t afford to fail.
          </p>

          {/* CTAs */}
          <div className="flex flex-wrap items-center justify-center gap-4 animate-fadeInUp delay-300" style={{ opacity: 0 }}>
            <a
              href="https://demo.synapseos.tech"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2.5 text-base font-bold px-8 py-4 rounded-xl transition-all pulse-glow"
              style={{ background: 'var(--brand-orange)', color: '#07070A' }}
            >
              <span style={{ position: 'relative', display: 'inline-flex', width: '0.5rem', height: '0.5rem' }}>
                <span style={{
                  position: 'absolute', inset: 0, borderRadius: '50%',
                  background: '#07070A', opacity: 0.6,
                  animation: 'ping 1.2s cubic-bezier(0,0,0.2,1) infinite',
                }} />
                <span style={{ position: 'relative', borderRadius: '50%', width: '0.5rem', height: '0.5rem', background: '#07070A' }} />
              </span>
              Try Live Demo
            </a>

            <Link
              href="/apply"
              className="inline-flex items-center gap-2 text-base font-semibold px-8 py-4 rounded-xl transition-all"
              style={{ border: '1px solid var(--border-gold)', color: 'var(--brand-gold)' }}
            >
              Apply for Pilot Access →
            </Link>
          </div>

          {/* Trust strip */}
          <div
            className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-10 animate-fadeInUp delay-400"
            style={{ opacity: 0 }}
          >
            {['DPPA 2019 Compliant', 'FHIR R4', 'ICD-11', 'HL7 ASTM', 'Offline-First', 'RLS on all tables'].map(t => (
              <span key={t} className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                ✓ {t}
              </span>
            ))}
          </div>
        </div>

        {/* Decorative bottom gradient */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: '8rem',
          background: 'linear-gradient(to top, var(--bg-base), transparent)',
          pointerEvents: 'none',
        }} />
      </section>

      {/* ── §2 LIVE METRICS BAR ──────────────────────────────────────────── */}
      <div
        style={{
          background: 'var(--bg-surface)',
          borderTop: '1px solid var(--border-edge)',
          borderBottom: '1px solid var(--border-edge)',
          padding: '0.875rem 0',
          overflow: 'hidden',
        }}
      >
        <div className="marquee-track">
          {[...METRICS, ...METRICS].map((m, i) => (
            <div
              key={i}
              className="flex items-center gap-3 px-8"
              style={{ flexShrink: 0 }}
            >
              <span className="font-display font-bold text-sm" style={{ color: 'var(--brand-orange)' }}>
                {m.val}
              </span>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {m.label}
              </span>
              <span style={{ color: 'var(--border-edge)', margin: '0 0.5rem' }}>◆</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── §3 PROBLEM STATEMENT ─────────────────────────────────────────── */}
      <section
        id="problem"
        className="relative px-6 py-24"
        style={{ background: 'var(--bg-base)', overflow: 'hidden' }}
      >
        <KenteBackground opacity={0.025} />
        <div style={{ maxWidth: '72rem', margin: '0 auto', position: 'relative', zIndex: 1 }}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            {/* Left: label + headline */}
            <div>
              <SectionLabel>The Problem</SectionLabel>
              <h2
                className="font-display font-bold mb-6"
                style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', lineHeight: 1.1, letterSpacing: '-0.02em' }}
              >
                African healthcare is drowning in
                {' '}<span style={{ color: 'var(--brand-orange)' }}>preventable inefficiency.</span>
              </h2>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                With 1 doctor for every 25,000 patients, every second wasted on paperwork,
                manual billing, and fragmented records is a second stolen from care.
                SynapseOS gives clinicians their time back — and gives hospitals their revenue back.
              </p>
            </div>

            {/* Right: stat cards */}
            <div className="grid grid-cols-1 gap-4">
              {[
                {
                  val: '1 : 25,000',
                  label: 'Doctor-to-patient ratio in Uganda',
                  sub: 'WHO recommends 1:1,000',
                  color: '#EF4444',
                },
                {
                  val: '40%',
                  label: 'Hospital revenue lost to billing inefficiency',
                  sub: 'Manual claims, missed charges, rejected insurance',
                  color: '#F97316',
                },
                {
                  val: '67%',
                  label: 'Clinical records still on paper',
                  sub: 'No continuity of care across facilities',
                  color: '#EAB308',
                },
              ].map(s => (
                <div
                  key={s.val}
                  className="p-6 rounded-2xl flex items-start gap-5"
                  style={{
                    background: 'var(--bg-surface)',
                    border: `1px solid ${s.color}25`,
                    borderLeft: `3px solid ${s.color}`,
                  }}
                >
                  <span
                    className="font-display font-black shrink-0"
                    style={{ fontSize: 'clamp(1.8rem, 3.5vw, 2.5rem)', color: s.color, lineHeight: 1 }}
                  >
                    {s.val}
                  </span>
                  <div>
                    <p className="font-semibold text-sm mb-1">{s.label}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{s.sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── §4 SOLUTION OVERVIEW ─────────────────────────────────────────── */}
      <section
        id="solution"
        className="px-6 py-24"
        style={{ background: 'var(--bg-surface)', borderTop: '1px solid var(--border-edge)' }}
      >
        <div style={{ maxWidth: '72rem', margin: '0 auto' }}>
          <div className="text-center mb-16">
            <SectionLabel>The Solution</SectionLabel>
            <h2
              className="font-display font-bold"
              style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.75rem)', letterSpacing: '-0.02em' }}
            >
              One platform. Two powerful products.
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* SynapseOS — for hospitals */}
            <div
              className="p-8 rounded-2xl relative overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, rgba(249,115,22,0.08), rgba(249,115,22,0.02))',
                border: '1px solid var(--border-orange)',
              }}
            >
              <div
                className="inline-flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-full mb-5"
                style={{ background: 'rgba(249,115,22,0.12)', color: 'var(--brand-orange)', border: '1px solid var(--border-orange)' }}
              >
                For Hospitals &amp; Clinics
              </div>
              <h3 className="font-display font-bold text-2xl mb-3">SynapseOS</h3>
              <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                A complete Health Management Information System built for African hospital
                complexity — from OPD to ICU, pharmacy to finance, all under one AI-native roof.
              </p>
              <ul className="space-y-2.5 mb-6">
                {[
                  'AI differential diagnosis grounded in Uganda Clinical Guidelines',
                  '20+ department modules with specialty-specific workflows',
                  'Insurance copilot: auto-submit claims, AI appeal drafting',
                  'Offline-first with local server fallback',
                  'Full RBAC with 10+ staff roles and RLS tenant isolation',
                ].map(f => (
                  <li key={f} className="flex items-start gap-2.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    <span style={{ color: 'var(--brand-orange)', marginTop: '0.1rem' }}>→</span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/apply"
                className="inline-flex items-center gap-2 text-sm font-bold px-5 py-2.5 rounded-xl transition-all"
                style={{ background: 'var(--brand-orange)', color: '#07070A' }}
              >
                Deploy for My Hospital
              </Link>
            </div>

            {/* Synapse App — for patients */}
            <div
              className="p-8 rounded-2xl relative overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, rgba(232,184,75,0.08), rgba(232,184,75,0.02))',
                border: '1px solid var(--border-gold)',
              }}
            >
              <div
                className="inline-flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-full mb-5"
                style={{ background: 'rgba(232,184,75,0.12)', color: 'var(--brand-gold)', border: '1px solid var(--border-gold)' }}
              >
                For Patients &amp; Families
              </div>
              <h3 className="font-display font-bold text-2xl mb-3">Synapse App</h3>
              <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                Your sovereign health companion. Your records, your appointments,
                your AI health insights — always with you. Works across every hospital
                in the Synapse network.
              </p>
              <ul className="space-y-2.5 mb-6">
                {[
                  'Personal health records with AI-plain-language lab results',
                  'Telemedicine: symptom chatbot → video consult → SOAP note',
                  'Wearable device sync (Fitbit, Garmin, Apple Watch)',
                  'Geo-filtered outbreak alerts and health bulletins',
                  'Emergency SOS with GPS Medical ID and contact chain',
                ].map(f => (
                  <li key={f} className="flex items-start gap-2.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    <span style={{ color: 'var(--brand-gold)', marginTop: '0.1rem' }}>→</span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/download"
                className="inline-flex items-center gap-2 text-sm font-bold px-5 py-2.5 rounded-xl transition-all"
                style={{ background: 'var(--brand-gold)', color: '#07070A' }}
              >
                Download the App
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── §5 FEATURE DEEP DIVE ─────────────────────────────────────────── */}
      <section
        id="features"
        className="px-6 py-24"
        style={{ background: 'var(--bg-base)', borderTop: '1px solid var(--border-edge)' }}
      >
        <div style={{ maxWidth: '72rem', margin: '0 auto' }}>
          <div className="text-center mb-14">
            <SectionLabel>Feature Deep Dive</SectionLabel>
            <h2
              className="font-display font-bold"
              style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.75rem)', letterSpacing: '-0.02em' }}
            >
              Five pillars that define the platform.
            </h2>
            <p className="mt-4 text-sm mx-auto" style={{ color: 'var(--text-secondary)', maxWidth: '40rem' }}>
              Every major clinical and operational workflow reimagined with AI at the centre.
            </p>
          </div>
          <FeatureTabs />
        </div>
      </section>

      {/* ── §6 DEPARTMENT MODULES ─────────────────────────────────────────── */}
      <section
        id="modules"
        className="px-6 py-24"
        style={{ background: 'var(--bg-elevated)', borderTop: '1px solid var(--border-edge)' }}
      >
        <div style={{ maxWidth: '72rem', margin: '0 auto' }}>
          <div className="text-center mb-14">
            <SectionLabel>Department Modules</SectionLabel>
            <h2
              className="font-display font-bold"
              style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.75rem)', letterSpacing: '-0.02em' }}
            >
              Every department. Every specialty. One system.
            </h2>
            <p className="mt-4 text-sm mx-auto" style={{ color: 'var(--text-secondary)', maxWidth: '40rem' }}>
              20+ clinical department modules, each built with specialty-specific workflows,
              AI tooling, and Ugandan clinical guidelines baked in.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {MODULES.map(m => (
              <div
                key={m.name}
                className="p-5 rounded-2xl transition-all cursor-default"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)' }}
              >
                <span
                  className="inline-flex items-center justify-center rounded-lg font-mono font-bold text-xs mb-3"
                  style={{
                    width: '2.25rem', height: '2.25rem',
                    background: 'rgba(249,115,22,0.1)',
                    color: 'var(--brand-orange)',
                    border: '1px solid var(--border-orange)',
                    letterSpacing: '0.04em',
                  }}
                >
                  {m.abbr}
                </span>
                <p className="font-display font-semibold text-sm mb-1.5">{m.name}</p>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>{m.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── §7 SDG COMMAND CENTER PREVIEW ────────────────────────────────── */}
      <section
        id="sdg"
        className="px-6 py-24"
        style={{ background: 'var(--bg-surface)', borderTop: '1px solid var(--border-edge)' }}
      >
        <div style={{ maxWidth: '72rem', margin: '0 auto' }}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <SectionLabel>SDG Command Center</SectionLabel>
              <h2
                className="font-display font-bold mb-5"
                style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.75rem)', letterSpacing: '-0.02em' }}
              >
                Turning clinical data into{' '}
                <span style={{ color: 'var(--brand-gold)' }}>global impact metrics.</span>
              </h2>
              <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                SynapseOS automatically maps every encounter, prescription, and outcome to the
                UN Sustainable Development Goals — generating verifiable, real-time progress
                reports your hospital can export for donors, government, and UN reporting.
              </p>
              <div className="flex flex-wrap gap-3">
                <span className="badge-orange">Nightly DHIS2 Export</span>
                <span className="badge-gold">UN CSV Export</span>
                <span className="badge-gold">GRI PDF Report</span>
              </div>
            </div>

            {/* SDG grid */}
            <div className="grid grid-cols-5 sm:grid-cols-6 gap-2">
              {SDGS.map(sdg => (
                <div
                  key={sdg.n}
                  className="flex flex-col items-center gap-1.5 p-2 rounded-xl"
                  style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-edge)' }}
                  title={sdg.label}
                >
                  <div
                    className="flex items-center justify-center rounded-lg font-display font-black text-xs"
                    style={{
                      width: '2.25rem', height: '2.25rem',
                      background: sdg.color,
                      color: '#fff',
                      fontSize: '0.65rem',
                    }}
                  >
                    {sdg.n}
                  </div>
                  {/* Progress bar */}
                  <div style={{ width: '100%', height: '3px', background: 'var(--bg-overlay)', borderRadius: '2px' }}>
                    <div style={{
                      height: '100%', width: `${sdg.pct}%`,
                      background: sdg.color, borderRadius: '2px',
                      transition: 'width 1s ease',
                    }} />
                  </div>
                  <span style={{ fontSize: '0.55rem', color: 'var(--text-muted)' }}>{sdg.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── §8 PRICING ───────────────────────────────────────────────────── */}
      <section
        id="pricing"
        className="relative px-6 py-24"
        style={{ background: 'var(--bg-base)', borderTop: '1px solid var(--border-edge)', overflow: 'hidden' }}
      >
        <KenteBackground opacity={0.03} />
        <div style={{ maxWidth: '72rem', margin: '0 auto', position: 'relative', zIndex: 1 }}>
          <div className="text-center mb-14">
            <SectionLabel>Pricing</SectionLabel>
            <h2
              className="font-display font-bold"
              style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.75rem)', letterSpacing: '-0.02em' }}
            >
              Simple, transparent pricing for African healthcare.
            </h2>
            <p className="mt-4 text-sm mx-auto" style={{ color: 'var(--text-secondary)', maxWidth: '40rem' }}>
              Start free. Scale as you grow. No surprise bills. All prices in Ugandan Shillings.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {TIERS.map(tier => (
              <div
                key={tier.name}
                className="p-6 rounded-2xl flex flex-col relative"
                style={{
                  background: tier.highlight ? 'var(--bg-surface)' : 'var(--bg-elevated)',
                  border: tier.highlight ? '1px solid var(--brand-orange)' : '1px solid var(--border-edge)',
                  boxShadow: tier.highlight ? '0 0 32px rgba(249,115,22,0.15)' : 'none',
                }}
              >
                {tier.badge && (
                  <div
                    className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold"
                    style={{ background: 'var(--brand-orange)', color: '#07070A', whiteSpace: 'nowrap' }}
                  >
                    {tier.badge}
                  </div>
                )}
                <p className="font-display font-bold text-lg mb-1">{tier.name}</p>
                <div className="mb-1">
                  <span
                    className="font-display font-black"
                    style={{
                      fontSize: tier.price === 'Custom' ? '1.5rem' : '1.25rem',
                      color: tier.highlight ? 'var(--brand-orange)' : 'var(--text-primary)',
                    }}
                  >
                    {tier.price}
                  </span>
                  <span className="text-xs ml-1" style={{ color: 'var(--text-muted)' }}>{tier.period}</span>
                </div>
                <p className="text-xs mb-5" style={{ color: 'var(--text-muted)' }}>{tier.description}</p>

                <ul className="space-y-2 flex-1 mb-6">
                  {tier.features.map(f => (
                    <li key={f} className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                      <span style={{ color: tier.highlight ? 'var(--brand-orange)' : 'var(--brand-gold)', flexShrink: 0 }}>✓</span>
                      {f}
                    </li>
                  ))}
                </ul>

                <Link
                  href={tier.ctaHref}
                  className="text-center text-sm font-bold py-2.5 rounded-xl transition-all"
                  style={{
                    background: tier.highlight ? 'var(--brand-orange)' : 'var(--bg-overlay)',
                    color: tier.highlight ? '#07070A' : 'var(--text-primary)',
                    border: tier.highlight ? 'none' : '1px solid var(--border-edge)',
                  }}
                >
                  {tier.cta}
                </Link>
              </div>
            ))}
          </div>

          {/* Add-ons row */}
          <div
            className="mt-10 p-6 rounded-2xl"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-edge)' }}
          >
            <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--text-muted)' }}>
              Add-On Modules
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { name: 'Telemedicine',   price: 'UGX 100K/mo' },
                { name: 'DICOM Viewer',   price: 'UGX 200K/mo' },
                { name: 'Teaching Hospital', price: 'UGX 150K/mo' },
                { name: 'Consumer Premium', price: 'UGX 15K/mo (patient)' },
                { name: 'Insurance Copilot', price: '8–12% success fee' },
                { name: 'AI API Overage',  price: 'UGX 200/call' },
              ].map(a => (
                <div key={a.name} className="p-3 rounded-xl text-center"
                     style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border-subtle)' }}>
                  <p className="text-xs font-semibold mb-0.5">{a.name}</p>
                  <p className="text-xs" style={{ color: 'var(--brand-gold)' }}>{a.price}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── §9 LIVE DEMO EMBED ───────────────────────────────────────────── */}
      <section
        id="demo"
        className="px-6 py-24"
        style={{ background: 'var(--bg-elevated)', borderTop: '1px solid var(--border-edge)' }}
      >
        <div style={{ maxWidth: '72rem', margin: '0 auto' }}>
          <div className="text-center mb-12">
            <SectionLabel>Live Demo</SectionLabel>
            <h2
              className="font-display font-bold"
              style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.75rem)', letterSpacing: '-0.02em' }}
            >
              See the AI diagnosis engine in action.
            </h2>
            <p className="mt-4 text-sm mx-auto" style={{ color: 'var(--text-secondary)', maxWidth: '36rem' }}>
              Type symptoms, pick chips, press diagnose. Powered by Gemini AI —
              no account needed.
            </p>
          </div>
          <DemoWidget />
        </div>
      </section>

      {/* ── §10 PILOT EVIDENCE / TESTIMONIALS ───────────────────────────── */}
      <section
        id="evidence"
        className="px-6 py-24"
        style={{ background: 'var(--bg-surface)', borderTop: '1px solid var(--border-edge)' }}
      >
        <div style={{ maxWidth: '72rem', margin: '0 auto' }}>
          <div className="text-center mb-14">
            <SectionLabel>Pilot Evidence</SectionLabel>
            <h2
              className="font-display font-bold"
              style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.75rem)', letterSpacing: '-0.02em' }}
            >
              Results from the field.
            </h2>
          </div>

          {/* Big stats row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-14">
            {[
              { val: '84%',   label: 'AI concordance with senior clinicians', color: 'var(--brand-orange)' },
              { val: '4.2s',  label: 'Median AI diagnosis response time',     color: 'var(--brand-gold)' },
              { val: '150+',  label: 'Clinical scoring instruments supported', color: 'var(--brand-orange)' },
              { val: '99.97%', label: 'Platform uptime across all modules',   color: 'var(--brand-gold)' },
            ].map(s => (
              <div
                key={s.val}
                className="p-6 rounded-2xl text-center"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-edge)' }}
              >
                <p
                  className="font-display font-black mb-2"
                  style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', color: s.color, lineHeight: 1 }}
                >
                  {s.val}
                </p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
              </div>
            ))}
          </div>

          {/* Quote cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              {
                quote: 'The differential diagnosis feature caught a case of bacterial meningitis that would have been treated as a simple headache. That patient is alive today because of the red flag alert.',
                author: 'Senior Medical Officer',
                role: 'Pilot Hospital, Kampala',
              },
              {
                quote: 'Insurance claims that used to take 3 weeks and come back rejected are now auto-submitted and approved within 48 hours. Our receivables are completely transformed.',
                author: 'Finance Director',
                role: 'Regional Referral Hospital',
              },
              {
                quote: "The offline-first architecture was non-negotiable for us. We lose internet frequently. With SynapseOS, our wards don't skip a beat.",
                author: 'Hospital Administrator',
                role: 'District Hospital, Western Uganda',
              },
            ].map(t => (
              <div
                key={t.author}
                className="p-6 rounded-2xl"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-edge)' }}
              >
                <div
                  className="text-2xl mb-4"
                  style={{ color: 'var(--brand-gold)', fontFamily: 'Georgia, serif' }}
                >
                  &ldquo;
                </div>
                <p className="text-sm mb-6 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {t.quote}
                </p>
                <div>
                  <p className="text-sm font-semibold">{t.author}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── §11 FOUNDER & CO-FOUNDER ──────────────────────────────────────── */}
      <section
        id="team"
        className="px-6 py-24"
        style={{ background: 'var(--bg-base)', borderTop: '1px solid var(--border-edge)' }}
      >
        <div style={{ maxWidth: '72rem', margin: '0 auto' }}>
          <div className="text-center mb-14">
            <SectionLabel>Meet the Team</SectionLabel>
            <h2
              className="font-display font-bold"
              style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.75rem)', letterSpacing: '-0.02em' }}
            >
              Built by people who know the problem firsthand.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto">
            {/* Ebrine Tushabe — Founder & CEO */}
            <div
              className="p-8 rounded-2xl flex flex-col items-start gap-5"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)' }}
            >
              <Image
                src="/team/founder.png"
                alt="Ebrine Tushabe"
                width={72}
                height={72}
                className="rounded-2xl object-cover shrink-0"
                style={{ border: '2px solid rgba(249,115,22,0.4)' }}
              />
              <div>
                <p className="font-display font-bold text-lg">Ebrine Tushabe</p>
                <p className="text-xs font-semibold mb-3" style={{ color: 'var(--brand-orange)' }}>Founder & CEO</p>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  Engineer and entrepreneur building sovereign health infrastructure for Africa.
                  Deeply familiar with the operational realities of Ugandan hospitals — and why existing software fails them.
                </p>
                <div className="flex gap-3 mt-4">
                  <a
                    href="mailto:founder@synapseos.tech"
                    className="text-xs font-semibold transition-colors"
                    style={{ color: 'var(--brand-orange)' }}
                  >
                    founder@synapseos.tech
                  </a>
                </div>
              </div>
            </div>

            {/* Nathan David — Co-Founder & Clinical Lead */}
            <div
              className="p-8 rounded-2xl flex flex-col items-start gap-5"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)' }}
            >
              <Image
                src="/team/cofounder.jpg"
                alt="Nathan David"
                width={72}
                height={72}
                className="rounded-2xl object-cover shrink-0"
                style={{ border: '2px solid rgba(232,184,75,0.4)' }}
              />
              <div>
                <p className="font-display font-bold text-lg">Nathan David</p>
                <p className="text-xs font-semibold mb-3" style={{ color: 'var(--brand-gold)' }}>Co-Founder & Clinical Lead</p>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  Bringing deep clinical expertise and hospital experience to every AI decision.
                  Ensures that every algorithm, every score, every alert reflects the realities of practice in Uganda.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── §12 PARTNER INTEGRATIONS ─────────────────────────────────────── */}
      <section
        id="partners"
        className="px-6 py-16"
        style={{ background: 'var(--bg-elevated)', borderTop: '1px solid var(--border-edge)' }}
      >
        <div style={{ maxWidth: '72rem', margin: '0 auto' }}>
          <p
            className="text-center text-xs font-bold uppercase tracking-widest mb-8"
            style={{ color: 'var(--text-muted)' }}
          >
            Trusted Integrations &amp; Standards
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {PARTNERS.map(p => (
              <div
                key={p.name}
                className="flex flex-col items-center px-5 py-3 rounded-xl"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)' }}
              >
                <span className="font-display font-bold text-sm">{p.name}</span>
                <span className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{p.sub}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── §13 COMPARISON TABLE ─────────────────────────────────────────── */}
      <section
        id="compare"
        className="px-6 py-24"
        style={{ background: 'var(--bg-surface)', borderTop: '1px solid var(--border-edge)' }}
      >
        <div style={{ maxWidth: '64rem', margin: '0 auto' }}>
          <div className="text-center mb-14">
            <SectionLabel>Comparison</SectionLabel>
            <h2
              className="font-display font-bold"
              style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.75rem)', letterSpacing: '-0.02em' }}
            >
              How SynapseOS stacks up.
            </h2>
          </div>

          <div
            className="rounded-2xl overflow-hidden"
            style={{ border: '1px solid var(--border-edge)' }}
          >
            {/* Header row */}
            <div
              className="grid text-xs font-bold uppercase tracking-wider"
              style={{
                gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
                background: 'var(--bg-elevated)',
                borderBottom: '1px solid var(--border-edge)',
                padding: '0.75rem 1rem',
              }}
            >
              <span style={{ color: 'var(--text-muted)' }}>Feature</span>
              <span style={{ color: 'var(--brand-orange)', textAlign: 'center' }}>SynapseOS</span>
              <span style={{ color: 'var(--text-muted)', textAlign: 'center' }}>OpenMRS</span>
              <span style={{ color: 'var(--text-muted)', textAlign: 'center' }}>Slade360</span>
              <span style={{ color: 'var(--text-muted)', textAlign: 'center' }}>Paper</span>
            </div>

            {COMPARE_ROWS.map((row, i) => (
              <div
                key={row.feature}
                className="grid text-sm items-center"
                style={{
                  gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
                  padding: '0.875rem 1rem',
                  background: i % 2 === 0 ? 'var(--bg-surface)' : 'var(--bg-elevated)',
                  borderBottom: i < COMPARE_ROWS.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                }}
              >
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{row.feature}</span>
                <span style={{ textAlign: 'center' }}><CellIcon v={row.synapse} /></span>
                <span style={{ textAlign: 'center' }}><CellIcon v={row.openmrs} /></span>
                <span style={{ textAlign: 'center' }}><CellIcon v={row.slade} /></span>
                <span style={{ textAlign: 'center' }}><CellIcon v={row.paper} /></span>
              </div>
            ))}
          </div>

          <p className="text-center text-xs mt-4" style={{ color: 'var(--text-muted)' }}>
            ~ = Partial / limited support
          </p>
        </div>
      </section>

      {/* ── §14 MOBILE APP PREVIEW ───────────────────────────────────────── */}
      <section
        id="app"
        className="px-6 py-24"
        style={{ background: 'var(--bg-base)', borderTop: '1px solid var(--border-edge)' }}
      >
        <div style={{ maxWidth: '72rem', margin: '0 auto' }}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            {/* Text side */}
            <div>
              <SectionLabel>Synapse App</SectionLabel>
              <h2
                className="font-display font-bold mb-5"
                style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.75rem)', letterSpacing: '-0.02em' }}
              >
                Your health, in your pocket.{' '}
                <span style={{ color: 'var(--brand-gold)' }}>Offline. Always.</span>
              </h2>
              <p className="text-sm mb-8" style={{ color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                The Synapse App puts your complete health record, telemedicine access,
                medication reminders, and outbreak alerts into a single Android app —
                built for Ugandan network conditions.
              </p>
              <ul className="space-y-3 mb-8">
                {[
                  'Personal Health Records — diagnoses, labs, immunisation card',
                  'AI-plain-language interpretation of lab results',
                  'Telemedicine video consult with AI SOAP note',
                  'Wearable sync: Fitbit, Garmin, Apple Watch',
                  'Geo-filtered outbreak alerts',
                  'Emergency SOS with GPS Medical ID',
                ].map(f => (
                  <li key={f} className="flex items-start gap-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    <span style={{ color: 'var(--brand-gold)', flexShrink: 0, marginTop: '0.1rem' }}>→</span>
                    {f}
                  </li>
                ))}
              </ul>
              <div className="flex gap-3 flex-wrap">
                <Link
                  href="/download"
                  className="inline-flex items-center gap-2 text-sm font-bold px-5 py-3 rounded-xl transition-all pulse-gold-glow"
                  style={{ background: 'var(--brand-gold)', color: '#07070A' }}
                >
                  Download APK
                </Link>
                <Link
                  href="/download#waitlist"
                  className="inline-flex items-center gap-2 text-sm font-semibold px-5 py-3 rounded-xl transition-all"
                  style={{ border: '1px solid var(--border-edge)', color: 'var(--text-secondary)' }}
                >
                  Join Waitlist
                </Link>
              </div>
            </div>

            {/* Phone mockup */}
            <div className="flex justify-center">
              <div
                className="relative animate-float"
                style={{
                  width: '240px',
                  background: 'var(--bg-surface)',
                  border: '2px solid var(--border-edge)',
                  borderRadius: '2.5rem',
                  padding: '1rem',
                  boxShadow: '0 40px 80px rgba(0,0,0,0.5), 0 0 0 4px rgba(255,255,255,0.04)',
                }}
              >
                {/* Notch */}
                <div style={{
                  width: '5rem', height: '1.25rem',
                  background: 'var(--bg-base)',
                  borderRadius: '0 0 1rem 1rem',
                  margin: '0 auto 0.75rem',
                }} />

                {/* Screen content */}
                <div
                  className="rounded-2xl overflow-hidden"
                  style={{ background: 'var(--bg-base)', padding: '1rem', minHeight: '380px' }}
                >
                  {/* App header */}
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="font-display font-bold text-xs">Good morning 👋</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)', fontSize: '0.6rem' }}>
                        Your Health Dashboard
                      </p>
                    </div>
                    <div
                      className="rounded-full flex items-center justify-center font-bold text-xs"
                      style={{
                        width: '1.75rem', height: '1.75rem',
                        background: 'rgba(249,115,22,0.15)',
                        color: 'var(--brand-orange)',
                        border: '1px solid var(--border-orange)',
                        fontSize: '0.6rem',
                      }}
                    >
                      ET
                    </div>
                  </div>

                  {/* Health score */}
                  <div
                    className="rounded-xl p-3 mb-3"
                    style={{ background: 'linear-gradient(135deg, rgba(249,115,22,0.15), rgba(232,184,75,0.1))', border: '1px solid var(--border-orange)' }}
                  >
                    <p className="font-bold text-sm" style={{ color: 'var(--brand-orange)', fontSize: '0.7rem' }}>Health Score</p>
                    <p className="font-display font-black" style={{ fontSize: '1.5rem', color: '#22C55E' }}>86</p>
                    <p style={{ fontSize: '0.55rem', color: 'var(--text-muted)' }}>↑ +3 from last week</p>
                  </div>

                  {/* Quick stats */}
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    {[
                      { label: 'Heart Rate', val: '72 bpm', color: '#EF4444' },
                      { label: 'SpO₂', val: '98%', color: '#38BDF8' },
                    ].map(s => (
                      <div
                        key={s.label}
                        className="rounded-xl p-2"
                        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)' }}
                      >
                        <p style={{ fontSize: '0.55rem', color: 'var(--text-muted)' }}>{s.label}</p>
                        <p className="font-bold" style={{ fontSize: '0.75rem', color: s.color }}>{s.val}</p>
                      </div>
                    ))}
                  </div>

                  {/* Alert */}
                  <div
                    className="rounded-xl p-2.5"
                    style={{ background: 'rgba(232,184,75,0.1)', border: '1px solid var(--border-gold)' }}
                  >
                    <p className="font-semibold" style={{ fontSize: '0.6rem', color: 'var(--brand-gold)' }}>
                      ⚠️ Health Bulletin
                    </p>
                    <p style={{ fontSize: '0.55rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                      Increased malaria cases in your district this week.
                    </p>
                  </div>
                </div>

                {/* Home indicator */}
                <div style={{
                  width: '4rem', height: '0.25rem',
                  background: 'var(--border-strong)',
                  borderRadius: '2px',
                  margin: '0.75rem auto 0',
                }} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── §15 SECURITY & COMPLIANCE ────────────────────────────────────── */}
      <section
        id="security"
        className="px-6 py-24"
        style={{ background: 'var(--bg-elevated)', borderTop: '1px solid var(--border-edge)' }}
      >
        <div style={{ maxWidth: '72rem', margin: '0 auto' }}>
          <div className="text-center mb-14">
            <SectionLabel>Security &amp; Compliance</SectionLabel>
            <h2
              className="font-display font-bold"
              style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.75rem)', letterSpacing: '-0.02em' }}
            >
              Patient data deserves sovereign protection.
            </h2>
            <p className="mt-4 text-sm mx-auto" style={{ color: 'var(--text-secondary)', maxWidth: '40rem' }}>
              Built with Uganda&apos;s Data Protection and Privacy Act 2019 as the baseline —
              not an afterthought. Every clinical record protected at every layer.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
            {TRUST.map(t => (
              <div
                key={t.title}
                className="p-6 rounded-2xl flex items-start gap-4"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)' }}
              >
                <span
                  className="inline-flex items-center justify-center rounded-lg font-mono font-bold text-xs shrink-0 mt-0.5"
                  style={{
                    width: '2.25rem', height: '2.25rem',
                    background: 'rgba(232,184,75,0.1)',
                    color: 'var(--brand-gold)',
                    border: '1px solid var(--border-gold)',
                    letterSpacing: '0.02em',
                    fontSize: '0.6rem',
                  }}
                >
                  {t.abbr}
                </span>
                <div>
                  <p className="font-semibold text-sm mb-1">{t.title}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>{t.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── §16 CALL TO ACTION ───────────────────────────────────────────── */}
      <section
        id="cta"
        className="relative px-6 py-24 overflow-hidden"
        style={{ background: 'var(--bg-base)', borderTop: '1px solid var(--border-edge)' }}
      >
        <KenteBackground opacity={0.06} />
        {/* Background glow */}
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '60%', height: '80%',
          background: 'radial-gradient(ellipse, rgba(249,115,22,0.12) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div style={{ maxWidth: '72rem', margin: '0 auto', position: 'relative', zIndex: 1 }}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Hospital CTA */}
            <div
              className="p-10 rounded-2xl text-center relative overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, rgba(249,115,22,0.12), rgba(249,115,22,0.04))',
                border: '1px solid var(--border-orange)',
              }}
            >
              <h3 className="font-display font-bold text-2xl mb-3">
                Deploy for Your Hospital
              </h3>
              <p className="text-sm mb-8" style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                Apply for pilot access. Our team handles setup, training,
                and data migration. Live in under 2 weeks.
              </p>
              <Link
                href="/apply"
                className="inline-flex items-center gap-2 text-base font-bold px-8 py-4 rounded-xl transition-all pulse-glow"
                style={{ background: 'var(--brand-orange)', color: '#07070A' }}
              >
                Apply for Pilot Access →
              </Link>
              <p className="text-xs mt-4" style={{ color: 'var(--text-muted)' }}>
                Free 30-day trial · No credit card required
              </p>
            </div>

            {/* Patient CTA */}
            <div
              className="p-10 rounded-2xl text-center relative overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, rgba(232,184,75,0.12), rgba(232,184,75,0.04))',
                border: '1px solid var(--border-gold)',
              }}
            >
              <h3 className="font-display font-bold text-2xl mb-3">
                Download Synapse App
              </h3>
              <p className="text-sm mb-8" style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                Take control of your health. Your records, your doctors,
                your AI health insights — always with you.
              </p>
              <Link
                href="/download"
                className="inline-flex items-center gap-2 text-base font-bold px-8 py-4 rounded-xl transition-all pulse-gold-glow"
                style={{ background: 'var(--brand-gold)', color: '#07070A' }}
              >
                Get the App →
              </Link>
              <p className="text-xs mt-4" style={{ color: 'var(--text-muted)' }}>
                Free forever · Android APK available now
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── §17 NEWSLETTER / WAITLIST ────────────────────────────────────── */}
      <section
        className="px-6 py-20"
        style={{ background: 'var(--bg-elevated)', borderTop: '1px solid var(--border-edge)' }}
      >
        <div style={{ maxWidth: '40rem', margin: '0 auto', textAlign: 'center' }}>
          <SectionLabel>Stay Updated</SectionLabel>
          <h2
            className="font-display font-bold mb-3"
            style={{ fontSize: 'clamp(1.5rem, 3vw, 2rem)', letterSpacing: '-0.02em' }}
          >
            Get updates from the frontlines of African health tech.
          </h2>
          <p className="text-sm mb-8" style={{ color: 'var(--text-secondary)' }}>
            New features, pilot stories, public health reports, and release announcements.
            No spam, unsubscribe any time.
          </p>
          <NewsletterForm />
        </div>
      </section>

      {/* ── §18 FOOTER ───────────────────────────────────────────────────── */}
      <footer
        className="px-6 pt-16 pb-8"
        style={{ background: 'var(--bg-base)', borderTop: '1px solid var(--border-edge)' }}
      >
        <div style={{ maxWidth: '72rem', margin: '0 auto' }}>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-10 mb-16">
            {/* Brand column */}
            <div className="col-span-2 md:col-span-1">
              <SynapseLogo size="md" className="mb-4" />
              <p className="text-xs leading-relaxed mb-4" style={{ color: 'var(--text-muted)', maxWidth: '16rem' }}>
                Sovereign AI health infrastructure for African hospitals.
                Built in Uganda for Africa.
              </p>
              <p className="text-xs font-semibold" style={{ color: 'var(--brand-gold)' }}>
                &ldquo;Every life deserves intelligence at its side.&rdquo;
              </p>
            </div>

            {/* Product */}
            <div>
              <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--text-muted)' }}>
                Product
              </p>
              <ul className="space-y-2.5">
                {([
                  ['/#features', 'Features'],
                  ['/#modules',  'Modules'],
                  ['/#pricing',  'Pricing'],
                  ['/changelog', 'Changelog'],
                  ['/docs',      'Documentation'],
                  ['/status',    'System Status'],
                ] as [string, string][]).map(([href, label]) => (
                  <li key={label}>
                    <Link href={href} className="text-xs transition-colors hover:text-white"
                          style={{ color: 'var(--text-muted)' }}>
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* For Hospitals */}
            <div>
              <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--text-muted)' }}>
                For Hospitals
              </p>
              <ul className="space-y-2.5">
                {([
                  ['/apply',    'Apply for Access'],
                  ['/#demo',    'Live Demo'],
                  ['/platform', 'Platform Overview'],
                  ['/os',       'Clinical OS'],
                  ['/#compare', 'Comparison'],
                  ['/contact',  'Contact Sales'],
                ] as [string, string][]).map(([href, label]) => (
                  <li key={label}>
                    <Link href={href} className="text-xs transition-colors hover:text-white"
                          style={{ color: 'var(--text-muted)' }}>
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* For Patients */}
            <div>
              <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--text-muted)' }}>
                For Patients
              </p>
              <ul className="space-y-2.5">
                {([
                  ['/download',    'Download App'],
                  ['/health',      'Health Dashboard'],
                  ['/signup',      'Create Account'],
                  ['/tele',        'Telemedicine'],
                  ['/health#imid', 'Medical ID (IMID)'],
                ] as [string, string][]).map(([href, label]) => (
                  <li key={label}>
                    <Link href={href} className="text-xs transition-colors hover:text-white"
                          style={{ color: 'var(--text-muted)' }}>
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Legal & Company */}
            <div>
              <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--text-muted)' }}>
                Company
              </p>
              <ul className="space-y-2.5">
                {([
                  ['/about',     'About'],
                  ['/blog',      'Blog'],
                  ['/careers',   'Careers'],
                  ['/press',     'Press'],
                  ['/contact',   'Contact'],
                  ['/legal',     'Privacy Policy'],
                  ['/legal#tos', 'Terms of Service'],
                ] as [string, string][]).map(([href, label]) => (
                  <li key={label}>
                    <Link href={href} className="text-xs transition-colors hover:text-white"
                          style={{ color: 'var(--text-muted)' }}>
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Bottom bar */}
          <div
            className="flex flex-col md:flex-row items-center justify-between gap-4 pt-8"
            style={{ borderTop: '1px solid var(--border-subtle)' }}
          >
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              © 2025–2026 Synapse Health Technologies Ltd · Kampala, Uganda ·{' '}
              <a href="mailto:founder@synapseos.tech"
                 className="hover:text-white transition-colors"
                 style={{ color: 'var(--text-muted)' }}>
                founder@synapseos.tech
              </a>
            </p>
            <div className="flex items-center gap-2">
              <span className="badge-gold">DPPA 2019</span>
              <span className="badge-orange">FHIR R4</span>
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(34,197,94,0.12)', color: '#22C55E', border: '1px solid rgba(34,197,94,0.25)' }}
              >
                ICD-11
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
