'use client'
import Link from 'next/link'
import { Building2, Stethoscope, UserRound } from 'lucide-react'
import { SynapseLogo } from '../../components/SynapseLogo'

const PATHS = [
  {
    href: '/signup/patient',
    icon: UserRound,
    label: "I'm a Patient",
    desc: 'Create your personal health passport. Track visits, medications, lab results, and manage your wellness journey.',
    badge: null,
  },
  {
    href: '/signup/professional',
    icon: Stethoscope,
    label: 'Healthcare Professional',
    desc: 'Join as a verified doctor, nurse, pharmacist, or licensed clinician. AI-assisted credentials review.',
    badge: 'Verified',
  },
  {
    href: '/signup/hospital-interest',
    icon: Building2,
    label: 'My Hospital / Clinic',
    desc: 'Register your facility to deploy Synapse OS across all departments. Request a personalised demo.',
    badge: 'Enterprise',
  },
]

export default function SignupPage() {
  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center px-4 py-16"
      style={{ background: 'var(--bg-base)' }}
    >
      <div className="w-full max-w-3xl">
        <div className="flex justify-center mb-10">
          <Link href="/"><SynapseLogo size="lg" /></Link>
        </div>
        <h1 className="text-3xl font-bold text-center mb-2" style={{ color: 'var(--text-primary)' }}>
          Create your account
        </h1>
        <p className="text-center mb-10 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Choose how you&apos;ll use Synapse OS
        </p>

        <div className="grid gap-4 md:grid-cols-3">
          {PATHS.map(({ href, icon: Icon, label, desc, badge }) => (
            <Link
              key={href}
              href={href}
              className="group relative flex flex-col rounded-2xl p-6 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg"
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-edge)',
              }}
            >
              {badge && (
                <span
                  className="absolute top-4 right-4 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                  style={{
                    background: 'rgba(249,115,22,0.12)',
                    color: 'var(--brand-orange)',
                    border: '1px solid var(--border-orange)',
                  }}
                >
                  {badge}
                </span>
              )}
              <div
                className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl shrink-0"
                style={{ background: 'rgba(249,115,22,0.12)', color: 'var(--brand-orange)' }}
              >
                <Icon className="h-6 w-6" />
              </div>
              <h2 className="font-bold text-base mb-2" style={{ color: 'var(--text-primary)' }}>{label}</h2>
              <p className="text-sm leading-relaxed flex-1" style={{ color: 'var(--text-secondary)' }}>{desc}</p>
              <div
                className="mt-6 flex items-center gap-1 text-sm font-semibold"
                style={{ color: 'var(--brand-orange)' }}
              >
                Get started →
              </div>
            </Link>
          ))}
        </div>

        <p className="text-center text-sm mt-8" style={{ color: 'var(--text-muted)' }}>
          Already have an account?{' '}
          <Link href="/login" style={{ color: 'var(--brand-orange)' }}>Sign in</Link>
        </p>
      </div>
    </main>
  )
}
