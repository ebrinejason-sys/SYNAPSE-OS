import Link from 'next/link'
import { SynapseLogo } from '../../components/SynapseLogo'
import { ArrowRight, Heart, LogIn, Smartphone, Stethoscope } from 'lucide-react'

export default function AppPortalPage() {
  return (
    <main className="min-h-screen" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
      <header
        className="flex items-center justify-between border-b px-6 py-4"
        style={{ borderColor: 'var(--border-subtle)', background: 'var(--nav-glass)' }}
      >
        <SynapseLogo size="md" />
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
            Sign in
          </Link>
          <Link
            href="/signup"
            className="rounded-lg px-4 py-2 text-sm font-semibold"
            style={{ background: 'var(--brand-teal)', color: '#07070A' }}
          >
            Create account
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-6 py-16 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: 'var(--brand-teal)' }}>
          Synapse personal health
        </p>
        <h1 className="font-display mt-4 text-4xl font-bold tracking-tight md:text-5xl">
          Your health. One account.
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          Track medications, lab results, visits, habits, and telemedicine. Health professionals get the same
          personal dashboard plus verified clinical tools.
        </p>

        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link
            href="/signup/patient"
            className="inline-flex items-center gap-2 rounded-xl px-6 py-3.5 text-sm font-semibold"
            style={{ background: 'var(--brand-teal)', color: '#07070A' }}
          >
            <Heart className="h-4 w-4" />
            Create free account
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-xl px-6 py-3.5 text-sm font-semibold"
            style={{ border: '1px solid var(--border-edge)', color: 'var(--text-primary)' }}
          >
            <LogIn className="h-4 w-4" />
            Sign in
          </Link>
          <Link
            href="/signup/professional"
            className="inline-flex items-center gap-2 rounded-xl px-6 py-3.5 text-sm font-semibold"
            style={{ border: '1px solid var(--border-gold)', color: 'var(--brand-gold)' }}
          >
            <Stethoscope className="h-4 w-4" />
            Join as professional
          </Link>
        </div>

        <div className="mt-14 grid gap-4 text-left sm:grid-cols-3">
          {[
            { title: 'Health dashboard', desc: 'Medications, labs, visits, habits, and AI health coach.', href: '/health/dashboard' },
            { title: 'Telemedicine', desc: 'Book consults with verified professionals on the network.', href: '/tele' },
            { title: 'Mobile app', desc: 'Android app for records and appointments on the go.', href: '/download' },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-xl p-5 transition-colors hover:opacity-95"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)' }}
            >
              <p className="font-semibold">{item.title}</p>
              <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
                {item.desc}
              </p>
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold" style={{ color: 'var(--brand-teal)' }}>
                Open <ArrowRight className="h-3 w-3" />
              </span>
            </Link>
          ))}
        </div>

        <p className="mt-12 text-sm" style={{ color: 'var(--text-muted)' }}>
          Facilities onboard at{' '}
          <a href="https://synapseos.tech" className="font-medium" style={{ color: 'var(--brand-orange)' }}>
            synapseos.tech
          </a>
          {' · '}
          <Smartphone className="inline h-3.5 w-3.5" /> Staff use your facility subdomain after invite
        </p>
      </div>
    </main>
  )
}
