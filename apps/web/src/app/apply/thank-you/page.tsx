import Link from 'next/link'
import { SynapseLogo } from '../../../components/SynapseLogo'

export default function ApplyThankYouPage() {
  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center px-6 text-center"
      style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}
    >
      <SynapseLogo size="lg" className="mb-10" />

      <div
        className="max-w-md p-10 rounded-2xl"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)' }}
      >
        <div
          className="inline-flex items-center justify-center rounded-full mb-6 font-bold text-xl"
          style={{
            width: '3.5rem', height: '3.5rem',
            background: 'rgba(34,197,94,0.12)',
            border: '1px solid rgba(34,197,94,0.3)',
            color: '#22C55E',
          }}
        >
          &#10003;
        </div>

        <h1 className="font-display font-bold text-2xl mb-3">Application received.</h1>

        <p className="text-sm leading-relaxed mb-8" style={{ color: 'var(--text-secondary)' }}>
          Thank you for applying to the Synapse OS pilot programme.
          Our team reviews every application personally and will be in touch within 24 hours.
        </p>

        <div className="flex flex-col gap-3">
          <a
            href="https://demo.synapseos.tech"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-3 rounded-xl font-bold text-sm text-center transition-all"
            style={{ background: 'var(--brand-orange)', color: '#07070A' }}
          >
            Try the Live Demo
          </a>
          <Link
            href="/"
            className="w-full py-3 rounded-xl font-semibold text-sm text-center transition-all"
            style={{
              background: 'var(--bg-elevated)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-edge)',
            }}
          >
            Back to Home
          </Link>
        </div>
      </div>
    </main>
  )
}
