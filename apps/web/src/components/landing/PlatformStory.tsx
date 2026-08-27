'use client'

import { CLINICAL_JOURNEY_STEPS, PLATFORM_CAPABILITIES, PRODUCTS } from '@synapse/config/manifest'
import { DEPLOYMENT_MODES, POSITIONING } from '@synapse/config/deployment-modes'
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
    { label: 'MODE 1 Native — OS · Lab · Pharm · App', tone: 'var(--brand-orange)' },
    { label: 'MODE 2 Overlay — eAFYA · UgandaEMR · ALIS · other EMRs', tone: 'var(--brand-gold)' },
    { label: 'MODE 3 Network — HIE / labs / pharmacies / national systems', tone: 'var(--brand-teal)' },
    { label: 'SYNAPSE EXCHANGE — adapters, never undocumented production APIs', tone: 'var(--brand-teal)' },
    { label: 'SYNAPSE INTELLIGENCE — reasoning, ICD-11, pathways, claims', tone: 'var(--text-primary)' },
    { label: 'SYNAPSE CORE — identity, consent, audit, timeline', tone: 'var(--text-primary)' },
    { label: 'Longitudinal patient record · FHIR representation', tone: 'var(--text-secondary)' },
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

export function DeploymentModes() {
  return (
    <div>
      <p className="mb-6 max-w-2xl text-sm" style={{ color: 'var(--text-secondary)' }}>
        {POSITIONING.differentiator} {POSITIONING.notAClaim}
      </p>
      <div className="grid gap-4 md:grid-cols-3">
        {DEPLOYMENT_MODES.map((mode) => (
          <article key={mode.id} className="landing-card !p-5">
            <p className="font-mono text-[10px] uppercase tracking-wide text-[var(--brand-gold)]">Mode {mode.id}</p>
            <h3 className="mt-2 text-lg font-semibold">{mode.name}</h3>
            <p className="mt-1 text-sm font-medium" style={{ color: 'var(--brand-orange)' }}>
              {mode.headline}
            </p>
            <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
              {mode.summary}
            </p>
            <p className="mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
              {mode.examples.join(' · ')}
            </p>
          </article>
        ))}
      </div>
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
