import Link from 'next/link'
import { SynapseLogo } from '../components/SynapseLogo'

export default function HomePage() {
  return (
    <main className="min-h-screen" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
      <nav className="flex items-center justify-between px-6 py-4"
           style={{ borderBottom: '1px solid var(--border-edge)' }}>
        <SynapseLogo size="md" />
        <div className="flex items-center gap-6">
          <Link href="/features" className="text-sm" style={{ color: 'var(--text-secondary)' }}>Features</Link>
          <Link href="/pricing"  className="text-sm" style={{ color: 'var(--text-secondary)' }}>Pricing</Link>
          <Link href="/about"    className="text-sm" style={{ color: 'var(--text-secondary)' }}>About</Link>
          <Link href="/apply"
                className="text-sm font-semibold px-4 py-2 rounded-xl transition-all"
                style={{ background: 'var(--brand-orange)', color: '#07070A' }}>
            Apply for Access
          </Link>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-24 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-8 text-xs font-semibold"
             style={{ background: 'rgba(232,184,75,0.12)', border: '1px solid var(--border-gold)', color: 'var(--brand-gold)' }}>
          Built in Uganda · Powered by Gemini AI
        </div>

        <h1 className="font-display font-bold mb-6"
            style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)', lineHeight: 1.1 }}>
          Every Hospital.<br />
          <span className="text-gold-gradient">Every Patient.</span><br />
          Every Step — AI-Assisted.
        </h1>

        <p className="text-lg mb-12 mx-auto"
           style={{ color: 'var(--text-secondary)', maxWidth: '42rem' }}>
          Synapse OS is an AI-powered Health Management Information System built for Africa.
          Every department. Every workflow. Offline-first. FHIR R4 compliant.
          Grounded in Uganda Clinical Guidelines.
        </p>

        <div className="flex flex-wrap gap-4 justify-center">
          <a href="https://demo.synapseos.tech"
             target="_blank"
             rel="noopener noreferrer"
             className="inline-flex items-center gap-2 text-base font-bold px-8 py-4 rounded-xl transition-all"
             style={{ background: 'var(--brand-orange)', color: '#07070A' }}>
            <span style={{ position: 'relative', display: 'inline-flex', height: '0.5rem', width: '0.5rem' }}>
              <span style={{
                position: 'absolute', display: 'inline-flex',
                height: '100%', width: '100%', borderRadius: '9999px',
                background: '#07070A', opacity: 0.75,
                animation: 'ping 1s cubic-bezier(0,0,0.2,1) infinite',
              }} />
              <span style={{
                position: 'relative', display: 'inline-flex',
                borderRadius: '9999px', height: '0.5rem', width: '0.5rem',
                background: '#07070A',
              }} />
            </span>
            Try Live Demo
          </a>

          <Link href="/apply"
                className="inline-flex items-center text-base font-semibold px-8 py-4 rounded-xl transition-all"
                style={{ border: '1px solid var(--border-gold)', color: 'var(--brand-gold)' }}>
            Apply for Pilot Access
          </Link>
        </div>
      </div>

      {/* Stats bar */}
      <div className="max-w-3xl mx-auto px-6 pb-16 grid grid-cols-3 gap-6 text-center">
        {[
          { val: '50+', label: 'Departments' },
          { val: 'FHIR R4', label: 'Compliant' },
          { val: 'Uganda-first', label: 'Built for Africa' },
        ].map(({ val, label }) => (
          <div key={label} className="py-6 rounded-2xl" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)' }}>
            <p className="font-display font-bold text-2xl" style={{ color: 'var(--brand-orange)' }}>{val}</p>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{label}</p>
          </div>
        ))}
      </div>
    </main>
  )
}
