'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { SynapseLogo } from '../../components/SynapseLogo'

function ResetPasswordContent() {
  const token = useSearchParams().get('token') ?? ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [redirectTo, setRedirectTo] = useState('/login')
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    const res = await fetch('/api/auth/password-reset/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    })
    const data = await res.json().catch(() => ({})) as { error?: string; redirectTo?: string }
    setLoading(false)

    if (!res.ok) {
      setError(data.error ?? 'Could not reset password.')
      return
    }

    setRedirectTo(data.redirectTo ?? '/login')
    setDone(true)
  }

  const inputStyle = {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-edge)',
    color: 'var(--text-primary)',
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4"
          style={{ background: 'var(--bg-base)' }}>
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8"><SynapseLogo size="lg" /></div>
        <h1 className="text-2xl font-bold text-center mb-1" style={{ color: 'var(--text-primary)' }}>Set new password</h1>
        <p className="text-center text-sm mb-8" style={{ color: 'var(--text-secondary)' }}>
          Choose a new Synapse OS password.
        </p>

        {done ? (
          <div className="space-y-4 text-center">
            <div className="p-6 rounded-2xl" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-gold)' }}>
              <p className="font-semibold mb-1">Password updated</p>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>You can now sign in with your new password.</p>
            </div>
            <a href={redirectTo} className="btn-primary block w-full">
              {redirectTo.startsWith('/platform') ? 'Go to platform sign in' : 'Back to sign in'}
            </a>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {!token && <p className="text-sm" style={{ color: '#EF4444' }}>This reset link is missing a token.</p>}
            <div className="relative">
              <input
                required
                autoComplete="new-password"
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="New password"
                className="w-full rounded-xl px-4 py-3 pr-10 text-sm outline-none"
                style={inputStyle}
              />
              <button type="button" onClick={() => setShowPw(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <input
              required
              autoComplete="new-password"
              type={showPw ? 'text' : 'password'}
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="Confirm new password"
              className="w-full rounded-xl px-4 py-3 text-sm outline-none"
              style={inputStyle}
            />
            {error && <p className="text-sm" style={{ color: '#EF4444' }}>{error}</p>}
            <button type="submit" disabled={loading || !token} className="btn-primary w-full disabled:opacity-50">
              {loading ? 'Updating...' : 'Update password'}
            </button>
          </form>
        )}
      </div>
    </main>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordContent />
    </Suspense>
  )
}
