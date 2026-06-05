'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { SynapseLogo } from '../../components/SynapseLogo'
import { createClient } from '../../lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) {
      setError('Invalid email or password.')
      setLoading(false)
      return
    }
    router.push('/health/dashboard')
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4"
          style={{ background: 'var(--bg-base)' }}>
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <SynapseLogo size="lg" />
        </div>
        <h1 className="text-2xl font-bold text-center mb-1" style={{ color: 'var(--text-primary)' }}>Welcome back</h1>
        <p className="text-center text-sm mb-8" style={{ color: 'var(--text-secondary)' }}>Sign in to your Synapse account</p>

        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="Email address"
            className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)', color: 'var(--text-primary)' }}
          />
          <input
            type="password"
            required
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)', color: 'var(--text-primary)' }}
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-50">
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-sm mt-6" style={{ color: 'var(--text-muted)' }}>
          New to Synapse?{' '}
          <a href="/onboarding" style={{ color: 'var(--brand-orange)' }}>Get started</a>
        </p>
      </div>
    </main>
  )
}
