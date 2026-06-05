'use client'
import { useState } from 'react'
import { SynapseLogo } from '../../components/SynapseLogo'
import { Smartphone, Wifi, Heart, Activity, Shield, Download } from 'lucide-react'

const APK_URL = process.env.NEXT_PUBLIC_APK_DOWNLOAD_URL || ''

const FEATURES = [
  { icon: Heart,    title: 'Personal Health Records',  desc: 'Your medical history, always in your pocket.' },
  { icon: Activity, title: 'Wearable Device Sync',     desc: 'Pair Fitbit, Withings, Omron and more.' },
  { icon: Wifi,     title: 'Works Offline',             desc: 'Full functionality even without internet.' },
  { icon: Shield,   title: 'Private & Secure',          desc: 'Your data never leaves Uganda servers.' },
]

export default function DownloadPage() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleWaitlist(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/apk/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })
      if (!res.ok) throw new Error('Failed to join waitlist')
      setSubmitted(true)
    } catch {
      setError('Could not sign up — please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4"
           style={{ borderBottom: '1px solid var(--border-edge)' }}>
        <SynapseLogo size="md" />
        <a href="/" style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
          ← Back to home
        </a>
      </nav>

      {/* Hero */}
      <div className="max-w-3xl mx-auto px-6 py-20 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-8 text-xs font-semibold"
             style={{ background: 'rgba(249,115,22,0.12)', border: '1px solid var(--border-orange)', color: 'var(--brand-orange)' }}>
          <Smartphone size={14} /> Android App
        </div>

        <h1 className="font-display font-bold text-4xl md:text-5xl mb-6" style={{ lineHeight: 1.15 }}>
          Synapse in your pocket.<br />
          <span className="text-gold-gradient">Your health, always on.</span>
        </h1>

        <p className="text-lg mb-10" style={{ color: 'var(--text-secondary)', maxWidth: '36rem', margin: '0 auto 2.5rem' }}>
          The Synapse Android app brings your personal health records, wearable sync,
          and AI health assistant offline — built for Uganda.
        </p>

        {APK_URL ? (
          <div className="flex flex-col items-center gap-4">
            <a href={APK_URL} download
               className="btn-primary inline-flex items-center gap-2 text-base px-8 py-4">
              <Download size={18} /> Download APK
            </a>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Android 8.0+ required · ~24 MB · Version 1.0.0
            </p>
            <div className="mt-6 p-4 rounded-xl text-left text-sm" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)' }}>
              <p className="font-semibold mb-2">Install instructions:</p>
              <ol className="list-decimal list-inside space-y-1" style={{ color: 'var(--text-secondary)' }}>
                <li>Download the APK file above</li>
                <li>Open your Downloads folder</li>
                <li>Tap the APK file to install</li>
                <li>If prompted, allow "Install unknown apps" for your browser</li>
                <li>Open Synapse and sign in with your account</li>
              </ol>
            </div>
          </div>
        ) : (
          <div className="max-w-md mx-auto">
            {submitted ? (
              <div className="p-6 rounded-2xl text-center" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-gold)' }}>
                <div className="text-3xl mb-3">🎉</div>
                <p className="font-semibold text-lg mb-1">You&apos;re on the list!</p>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                  We&apos;ll email you at <strong>{email}</strong> when the app launches.
                </p>
              </div>
            ) : (
              <form onSubmit={handleWaitlist} className="flex flex-col gap-3">
                <p className="font-semibold text-lg mb-2">Join the waitlist — launching soon</p>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-edge)',
                    color: 'var(--text-primary)',
                  }}
                />
                {error && <p className="text-xs text-red-400">{error}</p>}
                <button type="submit" disabled={loading} className="btn-primary w-full">
                  {loading ? 'Signing up…' : 'Notify me when ready'}
                </button>
              </form>
            )}
          </div>
        )}
      </div>

      {/* Features */}
      <div className="max-w-4xl mx-auto px-6 pb-24 grid grid-cols-1 sm:grid-cols-2 gap-6">
        {FEATURES.map(({ icon: Icon, title, desc }) => (
          <div key={title} className="p-6 rounded-2xl" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)' }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                 style={{ background: 'rgba(249,115,22,0.12)' }}>
              <Icon size={20} style={{ color: 'var(--brand-orange)' }} />
            </div>
            <p className="font-semibold mb-1">{title}</p>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{desc}</p>
          </div>
        ))}
      </div>
    </main>
  )
}
