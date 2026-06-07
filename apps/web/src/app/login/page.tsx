'use client'
import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { SynapseLogo } from '../../components/SynapseLogo'
import { ThemeToggle } from '../../components/ThemeToggle'
import { createClient } from '../../lib/supabase/client'

type AuthTab  = 'password' | 'email' | 'phone'
type SubStep  = 'form' | 'otp' | 'totp'

const inputStyle = {
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-edge)',
  color: 'var(--text-primary)',
}

function OtpInput({
  value,
  onChange,
  onFocus,
  onBlur,
}: {
  value: string
  onChange: (v: string) => void
  onFocus?: React.FocusEventHandler<HTMLInputElement>
  onBlur?: React.FocusEventHandler<HTMLInputElement>
}) {
  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]{6}"
      maxLength={6}
      autoFocus
      autoComplete="one-time-code"
      value={value}
      onChange={e => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
      placeholder="000000"
      className="w-full rounded-xl px-4 py-3 outline-none transition-all text-center tracking-[0.3em] font-mono text-2xl"
      style={inputStyle}
      onFocus={onFocus}
      onBlur={onBlur}
    />
  )
}

function ResendTimer({ onResend }: { onResend: () => void }) {
  const [secs, setSecs] = useState(60)

  useEffect(() => {
    if (secs <= 0) return
    const t = setTimeout(() => setSecs(s => s - 1), 1000)
    return () => clearTimeout(t)
  }, [secs])

  if (secs > 0) {
    return (
      <p className="text-center text-sm" style={{ color: 'var(--text-muted)' }}>
        Resend code in {secs}s
      </p>
    )
  }

  return (
    <button
      type="button"
      onClick={() => { onResend(); setSecs(60) }}
      className="w-full text-sm transition-colors"
      style={{ color: 'var(--brand-orange)' }}
    >
      Resend code
    </button>
  )
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div
      className="px-4 py-3 rounded-xl text-sm"
      style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#EF4444' }}
    >
      {msg}
    </div>
  )
}

function LoginContent() {
  const [tab,      setTab]      = useState<AuthTab>('password')
  const [subStep,  setSubStep]  = useState<SubStep>('form')

  // password tab
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [factorId, setFactorId] = useState('')
  const [challengeId, setChallengeId] = useState('')
  const [totpCode, setTotpCode] = useState('')

  // email OTP tab
  const [otpEmail, setOtpEmail] = useState('')
  const [emailCode, setEmailCode] = useState('')

  // phone tab
  const [phone,    setPhone]    = useState('')
  const [phoneCode, setPhoneCode] = useState('')

  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)

  const router      = useRouter()
  const searchParams = useSearchParams()
  const next        = searchParams.get('next') || '/health/dashboard'

  function switchTab(t: AuthTab) {
    setTab(t)
    setSubStep('form')
    setError('')
    setEmailCode('')
    setPhoneCode('')
    setTotpCode('')
  }

  // ─── Password login ────────────────────────────────────────
  async function handlePassword(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const supabase = createClient()
    const { error: authErr } = await supabase.auth.signInWithPassword({ email, password })
    if (authErr) {
      setError('Invalid email or password.')
      setLoading(false)
      return
    }
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    if (aal?.nextLevel === 'aal2' && aal.nextLevel !== aal.currentLevel) {
      const { data: factors } = await supabase.auth.mfa.listFactors()
      const totp = factors?.totp?.[0]
      if (totp) {
        const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId: totp.id })
        if (chErr || !ch) { setError('Could not initiate 2FA.'); setLoading(false); return }
        setFactorId(totp.id)
        setChallengeId(ch.id)
        setSubStep('totp')
        setLoading(false)
        return
      }
    }
    router.push(next)
  }

  async function handleTOTP(e: React.FormEvent) {
    e.preventDefault()
    if (totpCode.length !== 6) { setError('Enter the 6-digit code from your authenticator app.'); return }
    setLoading(true); setError('')
    const { error: verifyErr } = await createClient().auth.mfa.verify({ factorId, challengeId, code: totpCode })
    if (verifyErr) { setError('Incorrect code. Try again.'); setLoading(false); return }
    router.push(next)
  }

  // ─── Email OTP ─────────────────────────────────────────────
  async function sendEmailCode() {
    if (!otpEmail) return
    setLoading(true); setError('')
    const res = await fetch('/api/auth/email-otp/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: otpEmail }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setError(data.error ?? 'Failed to send code.'); return }
    setSubStep('otp')
  }

  async function verifyEmailCode(e: React.FormEvent) {
    e.preventDefault()
    if (emailCode.length !== 6) { setError('Enter the 6-digit code from your email.'); return }
    setLoading(true); setError('')
    const res = await fetch('/api/auth/email-otp/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: otpEmail, otp: emailCode }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Verification failed.'); setLoading(false); return }
    const { error: sessionErr } = await createClient().auth.verifyOtp({
      token_hash: data.token_hash,
      type: 'magiclink',
    })
    if (sessionErr) { setError('Could not create session. Please try again.'); setLoading(false); return }
    router.push(next)
  }

  // ─── Phone OTP ─────────────────────────────────────────────
  async function sendPhoneCode() {
    if (!phone) return
    setLoading(true); setError('')
    const res = await fetch('/api/auth/phone/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setError(data.error ?? 'Failed to send SMS.'); return }
    setSubStep('otp')
  }

  async function verifyPhoneCode(e: React.FormEvent) {
    e.preventDefault()
    if (phoneCode.length !== 6) { setError('Enter the 6-digit code from your SMS.'); return }
    setLoading(true); setError('')
    const res = await fetch('/api/auth/phone/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, otp: phoneCode }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Verification failed.'); setLoading(false); return }
    const { error: sessionErr } = await createClient().auth.verifyOtp({
      token_hash: data.token_hash,
      type: 'magiclink',
    })
    if (sessionErr) { setError('Could not create session. Please try again.'); setLoading(false); return }
    router.push(next)
  }

  const TABS: { id: AuthTab; label: string }[] = [
    { id: 'password', label: 'Password' },
    { id: 'email',    label: 'Email Code' },
    { id: 'phone',    label: 'Phone Code' },
  ]

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

      <div className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-sm">

          {/* ── TOTP step (overlays password tab) ── */}
          {tab === 'password' && subStep === 'totp' && (
            <>
              <div className="text-center mb-8">
                <div
                  className="inline-flex items-center justify-center rounded-2xl mb-5"
                  style={{ width: '3.5rem', height: '3.5rem', background: 'rgba(249,115,22,0.12)', border: '1px solid var(--border-orange)' }}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--brand-orange)" strokeWidth="2">
                    <rect x="5" y="11" width="14" height="10" rx="2"/>
                    <path d="M8 11V7a4 4 0 0 1 8 0v4"/>
                    <circle cx="12" cy="16" r="1" fill="currentColor"/>
                  </svg>
                </div>
                <h1 className="font-display font-bold text-2xl mb-2" style={{ letterSpacing: '-0.02em' }}>Two-factor auth</h1>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Enter the 6-digit code from your authenticator app</p>
              </div>
              <form onSubmit={handleTOTP} className="space-y-4">
                <OtpInput
                  value={totpCode}
                  onChange={v => { setTotpCode(v); if (error) setError('') }}
                  onFocus={e => (e.target.style.borderColor = 'var(--brand-orange)')}
                  onBlur={e => (e.target.style.borderColor = 'var(--border-edge)')}
                />
                {error && <ErrorBox msg={error} />}
                <button type="submit" disabled={loading || totpCode.length !== 6}
                  className="w-full py-3 rounded-xl font-bold text-sm transition-all"
                  style={{ background: 'var(--brand-orange)', color: '#07070A', opacity: loading || totpCode.length !== 6 ? 0.6 : 1 }}>
                  {loading ? 'Verifying…' : 'Verify & Sign In'}
                </button>
                <button type="button" onClick={() => { setSubStep('form'); setTotpCode(''); setError('') }}
                  className="w-full py-2.5 rounded-xl text-sm transition-all"
                  style={{ color: 'var(--text-secondary)', border: '1px solid var(--border-edge)', background: 'transparent' }}>
                  Back
                </button>
              </form>
            </>
          )}

          {/* ── Tabs + main forms ── */}
          {!(tab === 'password' && subStep === 'totp') && (
            <>
              <div className="text-center mb-7">
                <h1 className="font-display font-bold text-2xl mb-1.5" style={{ letterSpacing: '-0.02em' }}>Welcome back</h1>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Sign in to your Synapse account</p>
              </div>

              {/* Tab bar */}
              <div
                className="flex rounded-xl p-1 mb-6"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
              >
                {TABS.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => switchTab(t.id)}
                    className="flex-1 py-2 text-xs font-semibold rounded-lg transition-all"
                    style={tab === t.id
                      ? { background: 'var(--brand-orange)', color: '#07070A' }
                      : { color: 'var(--text-muted)', background: 'transparent' }
                    }
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* ── Password tab ── */}
              {tab === 'password' && subStep === 'form' && (
                <form onSubmit={handlePassword} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>Email address</label>
                    <input type="email" required autoFocus autoComplete="email"
                      value={email} onChange={e => setEmail(e.target.value)}
                      placeholder="you@hospital.ug"
                      className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all"
                      style={inputStyle}
                      onFocus={e => (e.target.style.borderColor = 'var(--brand-orange)')}
                      onBlur={e => (e.target.style.borderColor = 'var(--border-edge)')}
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Password</label>
                      <Link href="/forgot-password" className="text-xs transition-colors" style={{ color: 'var(--brand-orange)' }}>
                        Forgot password?
                      </Link>
                    </div>
                    <div className="relative">
                      <input type={showPass ? 'text' : 'password'} required autoComplete="current-password"
                        value={password} onChange={e => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all pr-11"
                        style={inputStyle}
                        onFocus={e => (e.target.style.borderColor = 'var(--brand-orange)')}
                        onBlur={e => (e.target.style.borderColor = 'var(--border-edge)')}
                      />
                      <button type="button" onClick={() => setShowPass(!showPass)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: 'var(--text-muted)' }}
                        aria-label={showPass ? 'Hide password' : 'Show password'}>
                        {showPass ? (
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
                  {error && <ErrorBox msg={error} />}
                  <button type="submit" disabled={loading || !email || !password}
                    className="w-full py-3 rounded-xl font-bold text-sm transition-all"
                    style={{ background: 'var(--brand-orange)', color: '#07070A', opacity: loading || !email || !password ? 0.6 : 1 }}>
                    {loading ? 'Signing in…' : 'Sign In'}
                  </button>
                </form>
              )}

              {/* ── Email OTP tab — form step ── */}
              {tab === 'email' && subStep === 'form' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>Email address</label>
                    <input type="email" autoFocus autoComplete="email"
                      value={otpEmail} onChange={e => setOtpEmail(e.target.value)}
                      placeholder="you@hospital.ug"
                      className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all"
                      style={inputStyle}
                      onFocus={e => (e.target.style.borderColor = 'var(--brand-orange)')}
                      onBlur={e => (e.target.style.borderColor = 'var(--border-edge)')}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); sendEmailCode() } }}
                    />
                  </div>
                  {error && <ErrorBox msg={error} />}
                  <button type="button" onClick={sendEmailCode}
                    disabled={loading || !otpEmail.includes('@')}
                    className="w-full py-3 rounded-xl font-bold text-sm transition-all"
                    style={{ background: 'var(--brand-orange)', color: '#07070A', opacity: loading || !otpEmail.includes('@') ? 0.6 : 1 }}>
                    {loading ? 'Sending code…' : 'Send verification code'}
                  </button>
                </div>
              )}

              {/* ── Email OTP tab — code entry ── */}
              {tab === 'email' && subStep === 'otp' && (
                <form onSubmit={verifyEmailCode} className="space-y-4">
                  <div className="text-center mb-2">
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      A 6-digit code was sent to<br/>
                      <strong style={{ color: 'var(--text-primary)' }}>{otpEmail}</strong>
                    </p>
                  </div>
                  <OtpInput
                    value={emailCode}
                    onChange={v => { setEmailCode(v); if (error) setError('') }}
                    onFocus={e => (e.target.style.borderColor = 'var(--brand-orange)')}
                    onBlur={e => (e.target.style.borderColor = 'var(--border-edge)')}
                  />
                  {error && <ErrorBox msg={error} />}
                  <button type="submit" disabled={loading || emailCode.length !== 6}
                    className="w-full py-3 rounded-xl font-bold text-sm transition-all"
                    style={{ background: 'var(--brand-orange)', color: '#07070A', opacity: loading || emailCode.length !== 6 ? 0.6 : 1 }}>
                    {loading ? 'Verifying…' : 'Verify & Sign In'}
                  </button>
                  <ResendTimer onResend={sendEmailCode} />
                  <button type="button" onClick={() => { setSubStep('form'); setEmailCode(''); setError('') }}
                    className="w-full py-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                    ← Change email
                  </button>
                </form>
              )}

              {/* ── Phone OTP tab — form step ── */}
              {tab === 'phone' && subStep === 'form' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>Phone number</label>
                    <input type="tel" autoFocus autoComplete="tel"
                      value={phone} onChange={e => setPhone(e.target.value)}
                      placeholder="+256 712 345 678"
                      className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all"
                      style={inputStyle}
                      onFocus={e => (e.target.style.borderColor = 'var(--brand-orange)')}
                      onBlur={e => (e.target.style.borderColor = 'var(--border-edge)')}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); sendPhoneCode() } }}
                    />
                    <p className="mt-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>Include country code, e.g. +256712345678</p>
                  </div>
                  {error && <ErrorBox msg={error} />}
                  <button type="button" onClick={sendPhoneCode}
                    disabled={loading || phone.length < 8}
                    className="w-full py-3 rounded-xl font-bold text-sm transition-all"
                    style={{ background: 'var(--brand-orange)', color: '#07070A', opacity: loading || phone.length < 8 ? 0.6 : 1 }}>
                    {loading ? 'Sending SMS…' : 'Send SMS code'}
                  </button>
                </div>
              )}

              {/* ── Phone OTP tab — code entry ── */}
              {tab === 'phone' && subStep === 'otp' && (
                <form onSubmit={verifyPhoneCode} className="space-y-4">
                  <div className="text-center mb-2">
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      A 6-digit SMS was sent to<br/>
                      <strong style={{ color: 'var(--text-primary)' }}>{phone}</strong>
                    </p>
                  </div>
                  <OtpInput
                    value={phoneCode}
                    onChange={v => { setPhoneCode(v); if (error) setError('') }}
                    onFocus={e => (e.target.style.borderColor = 'var(--brand-orange)')}
                    onBlur={e => (e.target.style.borderColor = 'var(--border-edge)')}
                  />
                  {error && <ErrorBox msg={error} />}
                  <button type="submit" disabled={loading || phoneCode.length !== 6}
                    className="w-full py-3 rounded-xl font-bold text-sm transition-all"
                    style={{ background: 'var(--brand-orange)', color: '#07070A', opacity: loading || phoneCode.length !== 6 ? 0.6 : 1 }}>
                    {loading ? 'Verifying…' : 'Verify & Sign In'}
                  </button>
                  <ResendTimer onResend={sendPhoneCode} />
                  <button type="button" onClick={() => { setSubStep('form'); setPhoneCode(''); setError('') }}
                    className="w-full py-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                    ← Change number
                  </button>
                </form>
              )}

              {/* Google OAuth — only on form step */}
              {subStep === 'form' && (
                <>
                  <div className="flex items-center gap-3 mt-5">
                    <div className="flex-1 h-px" style={{ background: 'var(--border-subtle)' }} />
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>or</span>
                    <div className="flex-1 h-px" style={{ background: 'var(--border-subtle)' }} />
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      setLoading(true)
                      await createClient().auth.signInWithOAuth({
                        provider: 'google',
                        options: {
                          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
                        },
                      })
                    }}
                    disabled={loading}
                    className="w-full mt-3 py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-3 transition-all"
                    style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-edge)', color: 'var(--text-primary)', opacity: loading ? 0.6 : 1 }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    Continue with Google
                  </button>
                  <p className="text-center text-sm mt-5" style={{ color: 'var(--text-muted)' }}>
                    Don&apos;t have an account?{' '}
                    <Link href="/signup" style={{ color: 'var(--brand-orange)', fontWeight: 600 }}>
                      Create account
                    </Link>
                  </p>
                </>
              )}
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
