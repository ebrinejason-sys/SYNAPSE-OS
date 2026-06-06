'use client'
import { useState } from 'react'

const TABS = [
  {
    id: 'clinical-ai',
    label: 'Clinical AI',
    heading: 'Differential Diagnosis at AI Speed',
    description:
      'MedGemma 27B generates ranked differential diagnoses grounded in Uganda Clinical Guidelines. Every suggestion cited, every confidence score explained — supporting, not replacing, clinical judgement.',
    stats: [
      { val: '84%', label: 'AI concordance with senior clinicians' },
      { val: '4.2s', label: 'Median diagnosis response time' },
      { val: '150+', label: 'Clinical scoring tools (NEWS2, SOFA, GCS…)' },
      { val: 'ICD-11', label: 'Coded, FHIR R4 compliant output' },
    ],
    features: [
      'Ranked differential with confidence bars + ICD-11 codes',
      'Supporting evidence vs counter-evidence per diagnosis',
      'Red flag detection and immediate escalation alerts',
      'Drug interaction checking via OpenFDA',
      'SOAP note AI generation from encounter context',
      'Real-time voice dictation (Whisper v3)',
      'Luganda & Swahili translation of clinical notes',
    ],
    color: '#F97316',
    bg: 'rgba(249,115,22,0.06)',
  },
  {
    id: 'insurance',
    label: 'Insurance Copilot',
    heading: 'Stop Losing Revenue to Rejected Claims',
    description:
      'Real-time coverage verification inline during ordering. Claims auto-submit the moment the doctor signs. When insurers reject, Gemini Pro drafts a formal appeal with UCG citations in under 10 seconds.',
    stats: [
      { val: '8–12%', label: 'Success fee on recovered claims above baseline' },
      { val: 'Live', label: 'Coverage check per order line placed' },
      { val: 'Auto', label: 'Claim submission on encounter signature' },
      { val: 'FHIR', label: 'Claim format for all major Ugandan insurers' },
    ],
    features: [
      'Live coverage badges (covered / partial / not covered) per order line',
      'Pre-authorisation workflow with status tracking',
      'FHIR Claim auto-generation on encounter sign',
      'AI appeal drafting with Uganda Clinical Guidelines citations',
      'Insurer performance analytics — approval rate, turnaround, denial patterns',
      'Patient insurance wallet supporting multiple policies',
      'Revenue recovery dashboard with trend analysis',
    ],
    color: '#E8B84B',
    bg: 'rgba(232,184,75,0.06)',
  },
  {
    id: 'lab',
    label: 'Lab Automation',
    heading: 'From Sample to Signed Result — Without Delays',
    description:
      'Auto-ingest results from lab instruments via ASTM/HL7 bridge. Critical values trigger a multi-channel notification chain in under one second. AI interprets results in the context of the working diagnosis.',
    stats: [
      { val: 'ASTM', label: 'HL7 instrument bridge for auto-result ingest' },
      { val: '<1s', label: 'Critical value detection and alerting' },
      { val: 'QC', label: 'Levey-Jennings + Westgard rules enforcement' },
      { val: 'Push', label: 'Patient notification on result authorisation' },
    ],
    features: [
      'STAT / Urgent / Routine specimen queue management',
      'Auto-ingest from compatible instruments (ASTM/HL7)',
      'Age and sex-adjusted reference ranges',
      'Critical value auto-flagging with notification chain',
      'AI result interpretation in clinical context',
      'Levey-Jennings QC charts with Westgard rule enforcement',
      'Microbiology antibiogram & AI antibiotic recommendation',
    ],
    color: '#22C55E',
    bg: 'rgba(34,197,94,0.06)',
  },
  {
    id: 'pharmacy',
    label: 'Pharmacy POS',
    heading: 'FEFO Dispense. Zero Expired Stock.',
    description:
      'First-Expiry-First-Out batch enforcement with barcode scanning, drug interaction checking, and mobile money integration. Full POS for walk-in retail and prescription dispense workflows.',
    stats: [
      { val: 'FEFO', label: 'Batch management with expiry enforcement' },
      { val: '30d', label: 'Advance expiry alert threshold (amber)' },
      { val: 'MTN/Airtel', label: 'Mobile money + cash + card supported' },
      { val: 'Auto', label: 'Reorder triggers on minimum stock levels' },
    ],
    features: [
      'Real-time prescription queue (STAT → Urgent → Routine)',
      'Barcode scan to dispense workflow',
      'OpenFDA + AI drug interaction checking',
      'FEFO batch selection enforcement with expiry alerts',
      'MTN / Airtel Mobile Money payment integration',
      'Controlled substance register with witness signatures',
      'Supplier management, purchase orders, price comparison',
    ],
    color: '#A78BFA',
    bg: 'rgba(167,139,250,0.06)',
  },
  {
    id: 'public-health',
    label: 'Public Health',
    heading: 'Population Intelligence, Not Just Patient Records',
    description:
      'SDG Command Center tracks all 17 goals using real clinical data. Outbreak detection alerts when disease spikes cluster. DHIS2 nightly export keeps national systems in sync — automatically.',
    stats: [
      { val: '17', label: 'SDG goals tracked with live clinical data' },
      { val: 'Nightly', label: 'Automated DHIS2 anonymised data export' },
      { val: 'Live', label: 'Outbreak detection via death registry sentinel' },
      { val: 'Push', label: 'District-level geo-filtered outbreak alerts' },
    ],
    features: [
      '17-goal SDG radial dashboard with drill-down',
      'Disease incidence heat maps with Mapbox choropleth',
      'Death registry sentinel — ≥3 infectious deaths → alert',
      'Anonymous surveillance reporting from patient app',
      'DHIS2 automated nightly export pipeline',
      'MPDSR maternal & perinatal death surveillance',
      'AEFI adverse event auto-reporting to NDA',
    ],
    color: '#38BDF8',
    bg: 'rgba(56,189,248,0.06)',
  },
]

export function FeatureTabs() {
  const [active, setActive] = useState(0)
  const tab = TABS[active] ?? TABS[0]!

  return (
    <div>
      {/* Tab bar */}
      <div
        className="flex gap-0 overflow-x-auto"
        style={{ borderBottom: '1px solid var(--border-edge)', marginBottom: '2.5rem' }}
      >
        {TABS.map((t, i) => (
          <button
            key={t.id}
            onClick={() => setActive(i)}
            className="flex items-center gap-2 px-5 py-3.5 text-sm font-semibold whitespace-nowrap transition-all"
            style={{
              color: active === i ? t.color : 'var(--text-muted)',
              borderBottom: active === i ? `2px solid ${t.color}` : '2px solid transparent',
              background: active === i ? t.bg : 'transparent',
              marginBottom: '-1px',
              borderRadius: '0.5rem 0.5rem 0 0',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div
        key={tab.id}
        style={{ animation: 'fadeIn 0.35s ease forwards' }}
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
          {/* Left: heading + description + stats grid */}
          <div>
            <h3
              className="font-display font-bold mb-4"
              style={{ fontSize: 'clamp(1.4rem, 2.5vw, 1.875rem)', lineHeight: 1.2 }}
            >
              {tab.heading}
            </h3>
            <p className="mb-8 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {tab.description}
            </p>

            <div className="grid grid-cols-2 gap-3">
              {tab.stats.map(s => (
                <div
                  key={s.label}
                  className="p-4 rounded-xl"
                  style={{
                    background: 'var(--bg-elevated)',
                    border: `1px solid ${tab.color}25`,
                  }}
                >
                  <p
                    className="font-display font-bold text-2xl mb-0.5"
                    style={{ color: tab.color }}
                  >
                    {s.val}
                  </p>
                  <p className="text-xs leading-tight" style={{ color: 'var(--text-muted)' }}>
                    {s.label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Right: feature list */}
          <div
            className="p-6 rounded-2xl"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)' }}
          >
            <p
              className="text-xs font-bold uppercase tracking-widest mb-5"
              style={{ color: 'var(--text-muted)' }}
            >
              Key Capabilities
            </p>
            <ul className="space-y-3">
              {tab.features.map(f => (
                <li
                  key={f}
                  className="flex items-start gap-3 text-sm"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <span
                    className="mt-0.5 shrink-0 flex items-center justify-center rounded-full text-xs font-bold"
                    style={{
                      width: '1.25rem',
                      height: '1.25rem',
                      background: tab.bg,
                      color: tab.color,
                      border: `1px solid ${tab.color}30`,
                    }}
                  >
                    ✓
                  </span>
                  {f}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
