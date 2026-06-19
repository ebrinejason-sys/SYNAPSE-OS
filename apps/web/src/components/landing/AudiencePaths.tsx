import Link from 'next/link'
import { ArrowRight, Heart, Pill, Stethoscope, Building2 } from 'lucide-react'
import { SynapseLogo } from '../../components/SynapseLogo'

const PATHS = [
  {
    icon: Building2,
    eyebrow: 'Hospitals & clinics',
    title: 'Onboard your facility',
    body: 'Apply for a pilot. We provision your subdomain, admin account, departments, and staff invites.',
    cta: 'Apply for hospital pilot',
    href: '/apply',
    accent: 'var(--brand-orange)',
    border: 'var(--border-orange)',
  },
  {
    icon: Pill,
    eyebrow: 'Pharmacies',
    title: 'Onboard your pharmacy',
    body: 'Inventory, FEFO batches, POS receipts, and refill requests — live at pharm.synapseos.tech.',
    cta: 'Apply for pharmacy',
    href: '/apply/pharmacy',
    accent: '#22C55E',
    border: 'rgba(34,197,94,0.35)',
  },
  {
    icon: Heart,
    eyebrow: 'Everyday users',
    title: 'Your personal health account',
    body: 'Track visits, medications, lab results, habits, and telemedicine — free to start.',
    cta: 'Create health account',
    href: '/signup/patient',
    accent: 'var(--brand-teal)',
    border: 'rgba(31,166,166,0.35)',
  },
  {
    icon: Stethoscope,
    eyebrow: 'Health professionals',
    title: 'Join as a verified clinician',
    body: 'Offer telemedicine and consultancy, access clinical tools, and use the same personal dashboard.',
    cta: 'Join as professional',
    href: '/signup/professional',
    accent: 'var(--brand-gold)',
    border: 'var(--border-gold)',
  },
]

export function AudiencePaths() {
  return (
    <section id="get-started" className="px-6 py-20" style={{ borderBottom: '1px solid var(--border-edge)' }}>
      <div className="mx-auto max-w-6xl">
        <p className="section-label">Who it&apos;s for</p>
        <h2 className="font-display mb-3 text-3xl font-bold tracking-tight">Four ways into Synapse</h2>
        <p className="mb-10 max-w-2xl text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          Facilities apply for onboarding. People self-register. One login can later link staff membership at a
          hospital or pharmacy without losing personal health features.
        </p>

        <div className="grid gap-5 sm:grid-cols-2">
          {PATHS.map((path) => (
            <article
              key={path.href}
              className="group flex flex-col rounded-2xl p-6 transition-all hover:-translate-y-0.5"
              style={{
                background: 'var(--bg-surface)',
                border: `1px solid ${path.border}`,
              }}
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-xl"
                  style={{ background: `${path.accent}18`, color: path.accent }}
                >
                  <path.icon className="h-5 w-5" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                  {path.eyebrow}
                </span>
              </div>
              <h3 className="font-display text-xl font-bold">{path.title}</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                {path.body}
              </p>
              <Link
                href={path.href}
                className="mt-5 inline-flex items-center gap-2 text-sm font-semibold transition-opacity group-hover:opacity-90"
                style={{ color: path.accent }}
              >
                {path.cta}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </article>
          ))}
        </div>

        <div
          className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-xl px-5 py-4"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-edge)' }}
        >
          <div className="flex items-center gap-3">
            <SynapseLogo size="sm" />
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Already have an account?{' '}
              <Link href="/login" className="font-semibold" style={{ color: 'var(--brand-orange)' }}>
                Sign in
              </Link>
              {' · '}
              Consumer app at{' '}
              <a href="https://app.synapseos.tech" className="font-medium" style={{ color: 'var(--brand-teal)' }}>
                app.synapseos.tech
              </a>
            </p>
          </div>
          <a
            href="https://demo.synapseos.tech"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold"
            style={{ color: 'var(--brand-gold)' }}
          >
            Try AI diagnostic demo →
          </a>
        </div>
      </div>
    </section>
  )
}
