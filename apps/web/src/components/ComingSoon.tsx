import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { SynapseLogo } from './SynapseLogo'
import { NewsletterForm } from './landing/NewsletterForm'

type ComingSoonProps = {
  title: string
  subtitle?: string
  eyebrow?: string
  showNotify?: boolean
  backHref?: string
  backLabel?: string
}

export function ComingSoon({
  title,
  subtitle = 'This area is in active development. We are building it with the same care as the rest of the platform and will share it here soon.',
  eyebrow = 'In development',
  showNotify = false,
  backHref = '/',
  backLabel = 'Back to home',
}: ComingSoonProps) {
  return (
    <main
      className="landing-page relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 py-20 text-center"
      style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}
    >
      {/* Ambient brand glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            'radial-gradient(ellipse 60% 50% at 50% 0%, var(--hero-glow) 0%, transparent 60%), radial-gradient(ellipse 40% 40% at 80% 90%, var(--hero-glow-gold) 0%, transparent 55%)',
        }}
      />

      <div className="relative z-10 mx-auto w-full max-w-xl">
        <div className="mb-8 flex justify-center">
          <Link href="/" aria-label="SynapseOS home">
            <SynapseLogo size="lg" />
          </Link>
        </div>

        <span
          className="mb-5 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em]"
          style={{
            background: 'rgba(249,115,22,0.10)',
            color: 'var(--brand-orange)',
            border: '1px solid var(--border-orange)',
          }}
        >
          <span className="landing-status-dot" style={{ background: 'var(--brand-orange)' }} />
          {eyebrow}
        </span>

        <h1
          className="font-display mb-4 font-bold"
          style={{
            fontSize: 'clamp(2rem, 5vw, 3rem)',
            lineHeight: 1.1,
            letterSpacing: '-0.03em',
          }}
        >
          <span className="text-gold-gradient">{title}</span>
        </h1>

        <p
          className="mx-auto mb-8 max-w-md text-base leading-relaxed"
          style={{ color: 'var(--text-secondary)' }}
        >
          {subtitle}
        </p>

        {showNotify && (
          <div className="mb-8">
            <p className="mb-3 text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
              Get notified when it goes live.
            </p>
            <NewsletterForm />
          </div>
        )}

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link href={backHref} className="landing-btn-secondary inline-flex items-center gap-2 px-5 py-3">
            <ArrowLeft className="h-4 w-4" />
            {backLabel}
          </Link>
          <Link href="/apply" className="landing-btn-primary inline-flex items-center gap-2 px-5 py-3">
            Apply for pilot access
          </Link>
        </div>
      </div>
    </main>
  )
}

export default ComingSoon
