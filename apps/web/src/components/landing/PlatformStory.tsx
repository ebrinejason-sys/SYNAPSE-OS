'use client'

import { CLINICAL_JOURNEY_STEPS, PLATFORM_CAPABILITIES, PRODUCTS, statusLabel } from '@synapse/config/manifest'
import { StatusBadge } from '../StatusBadge'
import { Eyebrow, SectionHeading } from '../typography'

export function ConnectedJourney() {
  return (
    <div>
      <Eyebrow className="mb-3">Connected journey</Eyebrow>
      <SectionHeading className="mb-4">One patient. One identity. One record.</SectionHeading>
      <p className="mb-8 max-w-2xl text-sm" style={{ color: 'var(--text-secondary)' }}>
        Registration, pathway, laboratory, prescription, pharmacy and follow-up share Synapse Core identity and
        Synapse Exchange events. This is the journey we are making real — not a list of two hundred features.
      </p>
      <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {CLINICAL_JOURNEY_STEPS.map((step, index) => (
          <li
            key={step.id}
            className="landing-card relative overflow-hidden !p-4"
          >
            <span className="font-mono text-[10px] text-[var(--brand-gold)]">{String(index + 1).padStart(2, '0')}</span>
            <p className="mt-2 text-sm font-semibold">{step.label}</p>
          </li>
        ))}
      </ol>
    </div>
  )
}

export function ArchitectureVisual() {
  const layers = [
    { label: 'Patients / Professionals / Facilities', tone: 'var(--text-secondary)' },
    { label: 'SYNAPSE PRODUCTS — OS · Pharm · App', tone: 'var(--brand-orange)' },
    { label: 'SYNAPSE CORE — identity, consent, audit', tone: 'var(--brand-gold)' },
    { label: 'SYNAPSE EXCHANGE — versioned events', tone: 'var(--brand-teal)' },
    { label: 'Clinical · Lab · Pharm · Imaging · Pathways · Finance', tone: 'var(--text-primary)' },
    { label: 'Shared longitudinal record', tone: 'var(--text-primary)' },
    { label: 'Analytics / AI / Epidemiology', tone: 'var(--text-secondary)' },
    { label: 'External health systems', tone: 'var(--text-muted)' },
  ]
  return (
    <div className="mx-auto max-w-3xl space-y-2">
      {layers.map((layer) => (
        <div
          key={layer.label}
          className="rounded-2xl border px-4 py-3 text-center text-sm font-medium"
          style={{ borderColor: 'var(--border-subtle)', color: layer.tone, background: 'var(--bg-surface)' }}
        >
          {layer.label}
        </div>
      ))}
    </div>
  )
}

export function ProductPlatformSplit() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <Eyebrow className="mb-3">Products</Eyebrow>
        <SectionHeading level={3} className="mb-4">
          What customers use
        </SectionHeading>
        <ul className="space-y-3">
          {PRODUCTS.map((item) => (
            <li key={item.id} className="landing-card !p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold">{item.name}</p>
                <StatusBadge status={item.status} />
              </div>
              <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                {item.publicClaim}
              </p>
              <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                {item.limitation}
              </p>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <Eyebrow className="mb-3">Platform capabilities</Eyebrow>
        <SectionHeading level={3} className="mb-4">
          What powers the products
        </SectionHeading>
        <ul className="space-y-3">
          {PLATFORM_CAPABILITIES.map((item) => (
            <li key={item.id} className="landing-card !p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold">{item.name}</p>
                <StatusBadge status={item.status} />
              </div>
              <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                {item.publicClaim}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
