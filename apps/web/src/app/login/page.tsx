'use client'
import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { SynapseLogo } from '../../components/SynapseLogo'
import { ThemeToggle } from '../../components/ThemeToggle'
import { createClient } from '../../lib/supabase/client'

type Step = 'password' | 'totp'

function LoginContent() {
  const [step, setStep] = useState<Step>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [factorId, setFactorId] = useState('')
  const [challengeId, setChallengeId] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next') || '/health/dashboard'

  const inputStyle = {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border-edge)',
    color: 'var(--text-primary)',
  }

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) {
      setError('Invalid email or password. Please try again.')
      setLoading(false)
      return
    }

    // Check if MFA is required (AAL2)
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    if (aal?.nextLevel === 'aal2' && aal.nextLevel !== aal.currentLevel) {
      const { data: factors } = await supabase.auth.mfa.listFactors()
      const totpFactor = factors?.totp?.[0]
      if (totpFactor) {
        // Issue a challenge
        const { data: challengeData, error: challengeErr } = await supabase.auth.mfa.challenge({ factorId: totpFactor.id })
        if (challengeErr || !challengeData) {
          setError('Could not initiate 2FA challenge. Please try again.')
          setLoading(false)
          return
        }
        setFactorId(totpFactor.id)
        setChallengeId(challengeData.id)
        setStep('totp')
        setLoading(false)
        return
      }
    }

    router.push(next)
  }

  async function handleTOTP(e: React.FormEvent) {
    e.preventDefault()
    if (totpCode.length !== 6) {
      setError('Enter the 6-digit code from your authenticator app.')
      return
    }
    setLoading(true)
    setError('')
    const supabase = createClient()

    const { error: verifyErr } = await supabase.auth.mfa.verify({
      factorId,
      challengeId,
      code: totpCode,
    })

    if (verifyErr) {
      setError('Incorrect code. Try again.')
      setLoading(false)
      return
    }

    router.push(next)
  }

  return (
    <main
      className="min-h-screen flex flex-col"
      style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}
    >
      {/* Nav */}
      <nav
        className="flex items-center justify-between px-6 py-4"
        style={{ borderBottom: '1px solid var(--border-subtle)' }}
      >
        <Link href="/"><SynapseLogo size="md" /></Link>
        <ThemeToggle />
      </nav>

      {/* Form area */}
      <div className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-sm">

          {step === 'password' && (
            <>
              <div className="text-center mb-8">
                <h1 className="font-display font-bold text-2xl mb-2" style={{ letterSpacing: '-0.02em' }}>
                  Welcome back
                </h1>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Sign in to your Synapse account
                </p>
              </div>

              <form onSubmit={handlePassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    Email address
                  </label>
                  <input
                    type="email"
                    required
                    autoFocus
                    autoComplete="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@hospital.ug"
                    className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all"
                    style={inputStyle}
                    onFocus={e => (e.target.style.borderColor = 'var(--brand-orange)')}
                    onBlur={e => (e.target.style.borderColor = 'var(--border-edge)')}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                      Password
                    </label>
                    <Link
                      href="/forgot-password"
                      className="text-xs transition-colors"
                      style={{ color: 'var(--brand-orange)' }}
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoComplete="current-password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all pr-11"
                      style={inputStyle}
                      onFocus={e => (e.target.style.borderColor = 'var(--brand-orange)')}
                      onBlur={e => (e.target.style.borderColor = 'var(--border-edge)')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs"
                      style={{ color: 'var(--text-muted)' }}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                          <line x1="1" y1="1" x2="23" y2="23"/>
                        </svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                          <circle cx="12" cy="12" r="3"/>
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                {error && (
                  <div
                    className="px-4 py-3 rounded-xl text-sm"
                    style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#EF4444' }}
                  >
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !email || !password}
                  className="w-full py-3 rounded-xl font-bold text-sm transition-all"
                  style={{
                    background: 'var(--brand-orange)',
                    color: '#07070A',
                    opacity: loading || !email || !password ? 0.6 : 1,
                  }}
                >
                  {loading ? 'Signing in…' : 'Sign In'}
                </button>
              </form>

              <p className="text-center text-sm mt-6" style={{ color: 'var(--text-muted)' }}>
                Don&apos;t have an account?{' '}
                <Link href="/signup" style={{ color: 'var(--brand-orange)', fontWeight: 600 }}>
                  Create account
                </Link>
              </p>
            </>
          )}

          {step === 'totp' && (
            <>
              <div className="text-center mb-8">
                <div
                  className="inline-flex items-center justify-center rounded-2xl mb-5"
                  style={{
                    width: '3.5rem', height: '3.5rem',
                    background: 'rgba(249,115,22,0.12)',
                    border: '1px solid var(--border-orange)',
                  }}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--brand-orange)" strokeWidth="2">
                    <rect x="5" y="11" width="14" height="10" rx="2"/>
                    <path d="M8 11V7a4 4 0 0 1 8 0v4"/>
                    <circle cx="12" cy="16" r="1" fill="currentColor"/>
                  </svg>
                </div>
                <h1 className="font-display font-bold text-2xl mb-2" style={{ letterSpacing: '-0.02em' }}>
                  Two-factor auth
                </h1>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Enter the 6-digit code from your authenticator app
                </p>
              </div>

              <form onSubmit={handleTOTP} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    Authentication code
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    required
                    autoFocus
                    autoComplete="one-time-code"
                    value={totpCode}
                    onChange={e => {
                      const v = e.target.value.replace(/\D/g, '').slice(0, 6)
                      setTotpCode(v)
                      if (error) setError('')
                    }}
                    placeholder="000 000"
                    className="w-full rounded-xl px-4 py-3 outline-none transition-all text-center tracking-widest font-mono text-xl"
                    style={inputStyle}
                    onFocus={e => (e.target.style.borderColor = 'var(--brand-orange)')}
                    onBlur={e => (e.target.style.borderColor = 'var(--border-edge)')}
                  />
                </div>

                {error && (
                  <div
                    className="px-4 py-3 rounded-xl text-sm"
                    style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#EF4444' }}
                  >
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || totpCode.length !== 6}
                  className="w-full py-3 rounded-xl font-bold text-sm transition-all"
                  style={{
                    background: 'var(--brand-orange)',
                    color: '#07070A',
                    opacity: loading || totpCode.length !== 6 ? 0.6 : 1,
                  }}
                >
                  {loading ? 'Verifying…' : 'Verify & Sign In'}
                </button>

                <button
                  type="button"
                  onClick={() => { setStep('password'); setTotpCode(''); setError('') }}
                  className="w-full py-2.5 rounded-xl text-sm transition-all"
                  style={{ color: 'var(--text-secondary)', border: '1px solid var(--border-edge)', background: 'transparent' }}
                >
                  Back to password
                </button>
              </form>
            </>
          )}

          {/* Trust line */}
          <div className="mt-10 pt-6 flex items-center justify-center gap-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
            {['DPPA 2019', 'Encrypted', 'FHIR R4'].map(t => (
              <span key={t} className="text-xs" style={{ color: 'var(--text-muted)' }}>✓ {t}</span>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  )
}
