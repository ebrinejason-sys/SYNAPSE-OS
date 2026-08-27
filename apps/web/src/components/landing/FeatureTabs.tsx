'use client'
import { useState } from 'react'
import { Eyebrow, SectionHeading } from '../typography'

const TABS = [
  {
    id: 'clinical-ai',
    label: 'Clinical AI',
    heading: 'Advisory support — clinician remains in control',
    description:
      'Experimental differential-diagnosis assistance can cite guidelines. Suggestions never become signed notes, never release laboratory results, and never dispense medication.',
    stats: [
      { val: 'Advisory', label: 'AI does not diagnose or treat autonomously' },
      { val: 'Override', label: 'Clinician confirmation is required' },
      { val: 'Prototype', label: 'Safety, provenance, and evaluation are incomplete' },
      { val: 'Audit', label: 'Sensitive actions belong in the audit trail' },
    ],
    features: [
      'Guideline-aware suggestions where the copilot is enabled',
      'No silent write-back into signed clinical documentation',
      'Uncertainty must remain visible',
      'Not a substitute for qualified clinical judgement',
    ],
    color: '#F97316',
    bg: 'rgba(249,115,22,0.06)',
  },
  {
    id: 'insurance',
    label: 'Insurance Copilot',
    heading: 'Claims assistance is still a prototype',
    description:
      'Internal invoices and an insurance copilot exist. Live payer auto-submit is not operational. Status is development / partial, not a national claims gateway.',
    stats: [
      { val: 'Partial', label: 'Invoice and claim concepts exist internally' },
      { val: 'Dev', label: 'No live insurer gateway' },
      { val: 'Human', label: 'Appeals and coding remain clinician/admin owned' },
      { val: 'Audit', label: 'Financial posts must stay server-authoritative' },
    ],
    features: [
      'Internal charge and invoice records',
      'Copilot drafts are advisory',
      'No fabricated first-pass acceptance rates',
      'Payer adapters are on the interoperability roadmap',
    ],
    color: '#E8B84B',
    bg: 'rgba(232,184,75,0.06)',
  },
  {
    id: 'lab',
    label: 'Synapse Lab',
    heading: 'Order → specimen → verify → record',
    description:
      'The first laboratory vertical slice is in development: clinician order, accession, result entry, verification, critical acknowledgement, and timeline. It is not a full LIMS and does not replace ALIS.',
    stats: [
      { val: 'Dev', label: 'Order-to-result slice, not a complete LIMS' },
      { val: 'Human', label: 'Verification is a laboratory professional action' },
      { val: 'Critical', label: 'Critical values require acknowledgement' },
      { val: 'ALIS', label: 'Future compatibility — not a replacement claim' },
    ],
    features: [
      'STAT / urgent / routine orders',
      'Specimen accession and rejection reasons',
      'Reference ranges and abnormal flags',
      'Amendments instead of silent overwrites',
      'Instrument parsers exist; live analyzer ingest is not connected',
    ],
    color: '#22C55E',
    bg: 'rgba(34,197,94,0.06)',
  },
  {
    id: 'pharmacy',
    label: 'Pharmacy POS',
    heading: 'FEFO inventory and online checkout',
    description:
      'Synapse Pharm is the deepest product: POS, batches, purchasing, receipts, and staff. Offline web checkout is disabled until durable encrypted persistence is proven.',
    stats: [
      { val: 'Candidate', label: 'Online POS is the operational-candidate workflow' },
      { val: 'FEFO', label: 'Batch selection is server-authoritative' },
      { val: 'Offline', label: 'Web checkout is disabled (not a silent queue)' },
      { val: 'Rx', label: 'Prescribing and dispensing stay separate permissions' },
    ],
    features: [
      'Printed receipts after a durable server sale',
      'FEFO batch enforcement',
      'Stock ledger via RPCs — not client-trusted quantities',
      'Clinical prescription intake as a separate permission from POS retail',
    ],
    color: '#A78BFA',
    bg: 'rgba(167,139,250,0.06)',
  },
  {
    id: 'public-health',
    label: 'Public Health',
    heading: 'Reporting is a roadmap, not a live national feed',
    description:
      'Surveillance concepts exist. DHIS2 currently records a pending export row. SYNAPSE does not claim live national reporting.',
    stats: [
      { val: 'Roadmap', label: 'DHIS2 export is not a live national pipeline' },
      { val: 'Lineage', label: 'Indicators must come from source clinical events' },
      { val: 'No fake', label: 'Outbreak dashboards are not operational' },
      { val: 'Pilot', label: 'Public-health modules will ship as versioned packs' },
    ],
    features: [
      'Honest status badges from the capability manifest',
      'No fabricated SDG completion percentages',
      'Event lineage is the path to reproducible reporting',
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
            <SectionHeading as="h3" level={1} className="mb-4">
              {tab.heading}
            </SectionHeading>
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
                    className="font-display mb-0.5 text-heading-2 tabular-nums tracking-tight"
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
            <Eyebrow variant="section" className="mb-5" style={{ color: 'var(--text-muted)' }}>
              Key Capabilities
            </Eyebrow>
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
