'use client'
import { useState } from 'react'
import { SynapseLogo } from '../../components/SynapseLogo'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    await fetch('/api/auth/password-reset/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    }).catch(() => null)
    setSent(true)
    setLoading(false)
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4"
          style={{ background: 'var(--bg-base)' }}>
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8"><SynapseLogo size="lg" /></div>
        <h1 className="text-2xl font-bold text-center mb-1" style={{ color: 'var(--text-primary)' }}>Reset password</h1>
        <p className="text-center text-sm mb-8" style={{ color: 'var(--text-secondary)' }}>
          We&apos;ll send a reset link to your email
        </p>
        {sent ? (
          <div className="p-6 rounded-2xl text-center" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-gold)' }}>
            <p className="font-semibold mb-1">Check your inbox</p>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              If that account exists, we sent a reset link to <strong>{email}</strong>
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)}
                   placeholder="Email address"
                   className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                   style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)', color: 'var(--text-primary)' }} />
            <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-50">
              {loading ? 'Sending...' : 'Send reset link'}
            </button>
          </form>
        )}
        <p className="text-center text-sm mt-6">
          <a href="/login" style={{ color: 'var(--brand-orange)' }}>Back to sign in</a>
        </p>
      </div>
    </main>
  )
}
