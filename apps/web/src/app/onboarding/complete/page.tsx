'use client'
import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '../../../lib/supabase/client'
import { SynapseLogo } from '../../../components/SynapseLogo'

export default function OnboardingCompletePage() {
  const sentRef = useRef(false)

  useEffect(() => {
    if (sentRef.current) return
    sentRef.current = true

    // Fire-and-forget welcome email — gated by user ID in localStorage to avoid duplicates
    createClient().auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      const key = `welcome_sent_${user.id}`
      if (localStorage.getItem(key)) return
      fetch('/api/auth/welcome', { method: 'POST' })
        .then(() => localStorage.setItem(key, '1'))
        .catch(console.error)
    })
  }, [])

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}
    >
      <div className="mb-8">
        <SynapseLogo size="md" />
      </div>
      <div
        className="w-full max-w-md text-center p-10 rounded-2xl"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)' }}
      >
        <div
          className="inline-flex items-center justify-center rounded-2xl mb-6"
          style={{
            width: '3.5rem', height: '3.5rem',
            background: 'rgba(249,115,22,0.12)',
            border: '1px solid var(--border-orange)',
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--brand-orange)" strokeWidth="2">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        <h1 className="font-display font-bold text-2xl mb-2" style={{ letterSpacing: '-0.02em' }}>
          Onboarding complete
        </h1>
        <p className="text-sm mb-8" style={{ color: 'var(--text-secondary)' }}>
          Your Synapse OS account is fully set up. Welcome to Africa&apos;s sovereign health platform.
        </p>

        <Link
          href="/health/dashboard"
          className="inline-block w-full py-3 rounded-xl font-bold text-sm text-center transition-all"
          style={{ background: 'var(--brand-orange)', color: '#07070A' }}
        >
          Open Dashboard →
        </Link>

        <div className="mt-4 flex items-center justify-center gap-4">
          {['DPPA 2019', 'Encrypted', 'Audit-ready'].map(t => (
            <span key={t} className="text-xs" style={{ color: 'var(--text-muted)' }}>✓ {t}</span>
          ))}
        </div>
      </div>
    </main>
  )
}
