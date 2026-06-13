import Link from 'next/link'
import { Building2, Shield, Stethoscope } from 'lucide-react'
import { SynapseLogo } from '../../components/SynapseLogo'

const entryPoints = [
  {
    href: '/platform/login',
    title: 'Platform Control Center',
    body: 'Manage facilities, pharmacies, tenants, and system operations.',
    icon: Shield,
  },
  {
    href: '/signup/hospital-interest',
    title: 'Register a Facility',
    body: 'Apply to deploy Synapse OS for a hospital, clinic, or pharmacy.',
    icon: Building2,
  },
  {
    href: '/login',
    title: 'Staff and Patient Login',
    body: 'Use your Synapse account to enter the correct workspace.',
    icon: Stethoscope,
  },
]

export default function OsPage() {
  return (
    <main className="min-h-screen px-6 py-10" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
      <div className="mx-auto max-w-4xl">
        <Link href="/" className="inline-flex">
          <SynapseLogo size="md" />
        </Link>

        <div className="mt-14 max-w-2xl">
          <p className="section-label">Clinical OS</p>
          <h1 className="font-display text-3xl font-bold md:text-5xl">Choose your Synapse OS entry point.</h1>
          <p className="mt-4 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
            One platform, one custom-auth session, routed into the workspace that belongs to the signed-in user.
          </p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {entryPoints.map(({ href, title, body, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="rounded-2xl p-5 transition-transform hover:-translate-y-0.5"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)' }}
            >
              <Icon className="h-6 w-6" style={{ color: 'var(--brand-orange)' }} />
              <h2 className="mt-4 text-base font-bold">{title}</h2>
              <p className="mt-2 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>{body}</p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  )
}
