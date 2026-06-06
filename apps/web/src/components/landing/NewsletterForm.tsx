'use client'
import { useState } from 'react'

export function NewsletterForm() {
  const [email,  setEmail]  = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.includes('@')) return
    setStatus('loading')
    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      })
      if (!res.ok) throw new Error()
      setStatus('success')
      setEmail('')
    } catch {
      setStatus('error')
    }
  }

  if (status === 'success') {
    return (
      <div className="text-center py-2" style={{ animation: 'fadeInUp 0.4s ease forwards' }}>
        <div
          className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-3 text-xl"
          style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)' }}
        >
          ✓
        </div>
        <p className="font-display font-semibold text-base" style={{ color: '#22C55E' }}>
          You&apos;re on the list.
        </p>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          We&apos;ll notify you about new features, pilots, and releases.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-sm mx-auto">
      <div className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="your@email.com"
          required
          className="flex-1 px-4 py-3 rounded-xl text-sm transition-all"
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-edge)',
            color: 'var(--text-primary)',
            outline: 'none',
          }}
          onFocus={e => (e.target.style.borderColor = 'var(--brand-gold)')}
          onBlur={e  => (e.target.style.borderColor = 'var(--border-edge)')}
        />
        <button
          type="submit"
          disabled={status === 'loading'}
          className="px-5 py-3 rounded-xl font-bold text-sm transition-all"
          style={{
            background: 'var(--brand-orange)',
            color: '#07070A',
            opacity: status === 'loading' ? 0.7 : 1,
          }}
        >
          {status === 'loading' ? '…' : 'Subscribe'}
        </button>
      </div>
      {status === 'error' && (
        <p className="text-xs mt-2 text-center" style={{ color: '#EF4444' }}>
          Something went wrong — please try again.
        </p>
      )}
    </form>
  )
}
