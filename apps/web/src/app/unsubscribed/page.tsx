import Link from 'next/link'
import { SynapseLogo } from '../../components/SynapseLogo'

export const metadata = { title: 'Unsubscribed — Synapse OS' }

export default function UnsubscribedPage() {
  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}
    >
      <div className="mb-8">
        <SynapseLogo size="md" />
      </div>
      <div
        className="w-full max-w-sm text-center p-8 rounded-2xl"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)' }}
      >
        <div
          className="inline-flex items-center justify-center rounded-2xl mb-5"
          style={{
            width: '3rem', height: '3rem',
            background: 'rgba(34,197,94,0.1)',
            border: '1px solid rgba(34,197,94,0.2)',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h1 className="font-display font-bold text-xl mb-2" style={{ letterSpacing: '-0.02em' }}>
          You&apos;ve been unsubscribed
        </h1>
        <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
          You&apos;ve been removed from the Synapse OS newsletter. You won&apos;t receive further updates.
        </p>
        <Link
          href="/"
          className="inline-block text-sm font-semibold rounded-xl px-5 py-2.5 transition-all"
          style={{ background: 'var(--brand-orange)', color: '#07070A' }}
        >
          Back to Synapse OS
        </Link>
      </div>
    </main>
  )
}
