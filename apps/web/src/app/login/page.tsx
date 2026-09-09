'use client'
import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { SynapseLogo } from '../../components/SynapseLogo'
import { ThemeToggle } from '../../components/ThemeToggle'

type AuthTab  = 'password' | 'email' | 'phone'
type SubStep  = 'form' | 'otp'

const inputStyle = {
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-edge)',
  color: 'var(--text-primary)',
}

const ACTIVATION_REQUIRED_MESSAGE = 'Activate your account from the email we sent before signing in.'

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

function NoticeBox({ msg }: { msg: string }) {
  return (
    <div
      className="px-4 py-3 rounded-xl text-sm"
      style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.22)', color: '#22C55E' }}
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
  // email OTP tab
  const [otpEmail, setOtpEmail] = useState('')
  const [emailCode, setEmailCode] = useState('')

  // phone tab
  const [phone,    setPhone]    = useState('')
  const [phoneCode, setPhoneCode] = useState('')

  const [error,   setError]   = useState('')
  const [notice,  setNotice]  = useState('')
  const [loading, setLoading] = useState(false)

  const router      = useRouter()
  const searchParams = useSearchParams()
  const next        = searchParams.get('next') || '/health/dashboard'
  const activated   = searchParams.get('activated') === '1'
  const activationStatus = searchParams.get('activation')
  const activationEmail = searchParams.get('email')

  function switchTab(t: AuthTab) {
    setTab(t)
    setSubStep('form')
    setError('')
    setNotice('')
    setEmailCode('')
    setPhoneCode('')
  }

  async function resendActivation(emailAddress: string) {
    if (!emailAddress) return
    setNotice('')
    const res = await fetch('/api/auth/activation/resend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailAddress }),
    })
    const data = await res.json().catch(() => ({})) as {
      activationEmailSent?: boolean
      error?: string
    }

    if (!res.ok) {
      setNotice(data.error ?? 'Could not resend activation email.')
      return
    }

    setNotice(
      data.activationEmailSent === false
        ? 'The account is still pending, but email delivery is currently unavailable.'
        : 'Activation email sent. Check your inbox and spam folder.'
    )
  }

  // ─── Password login ────────────────────────────────────────
  async function handlePassword(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/auth/password-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json().catch(() => ({})) as { error?: string }
      if (!res.ok) {
        setError(data.error ?? 'Invalid email or password.')
        return
      }
      setOtpEmail(email)
      setEmailCode('')
      setSubStep('otp')
    } catch {
      setError('Unable to reach SYNAPSE. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  async function verifyPasswordCode(e: React.FormEvent) {
    e.preventDefault()
    if (emailCode.length !== 6) { setError('Enter the 6-digit code from your email.'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/auth/email-otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp: emailCode }),
      })
      const data = await res.json().catch(() => ({})) as {
        ok?: boolean
        mfaRequired?: boolean
        mfaSetupRequired?: boolean
        redirectTo?: string
        error?: string
      }
      if (!res.ok) { setError(data.error ?? 'Verification failed.'); return }
      if (data.mfaSetupRequired) { router.push('/platform/mfa'); return }
      if (data.mfaRequired) { router.push('/platform/mfa-verify'); return }
      const dest = data.redirectTo ?? next
      if (dest.startsWith('http')) { window.location.href = dest; return }
      router.push(dest)
    } catch {
      setError('Unable to reach the authentication service. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function resendPasswordCode() {
    if (!email || !password) return
    setError('')
    await fetch('/api/auth/password-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    }).catch(() => null)
  }

  // ─── Email OTP ─────────────────────────────────────────────
  async function sendEmailCode() {
    if (!otpEmail) return
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/auth/email-otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: otpEmail }),
      })
      const data = await res.json().catch(() => ({})) as { error?: string }
      if (!res.ok) { setError(data.error ?? 'Failed to send code.'); return }
      setSubStep('otp')
    } catch {
      setError('Unable to reach the authentication service. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function verifyEmailCode(e: React.FormEvent) {
    e.preventDefault()
    if (emailCode.length !== 6) { setError('Enter the 6-digit code from your email.'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/auth/email-otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: otpEmail, otp: emailCode }),
      })
      const data = await res.json().catch(() => ({})) as {
        ok?: boolean
        mfaRequired?: boolean
        mfaSetupRequired?: boolean
        redirectTo?: string
        error?: string
      }
      if (!res.ok) { setError(data.error ?? 'Verification failed.'); return }
      if (data.mfaSetupRequired) { window.location.href = '/platform/mfa'; return }
      if (data.mfaRequired) { window.location.href = '/platform/mfa-verify'; return }
      const dest = data.redirectTo ?? next
      if (dest.startsWith('http')) { window.location.href = dest; return }
      window.location.href = dest
    } catch {
      setError('Unable to reach the authentication service. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // ─── Phone OTP ─────────────────────────────────────────────
  async function sendPhoneCode() {
    if (!phone) return
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/auth/phone/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      })
      const data = await res.json().catch(() => ({})) as { error?: string }
      if (!res.ok) { setError(data.error ?? 'Failed to send SMS.'); return }
      setSubStep('otp')
    } catch {
      setError('Unable to reach the authentication service. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function verifyPhoneCode(e: React.FormEvent) {
    e.preventDefault()
    if (phoneCode.length !== 6) { setError('Enter the 6-digit code from your SMS.'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/auth/phone/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otp: phoneCode }),
      })
      const data = await res.json().catch(() => ({})) as { error?: string }
      if (!res.ok) { setError(data.error ?? 'Verification failed.'); return }
      router.push(next)
    } catch {
      setError('Unable to reach the authentication service. Please try again.')
    } finally {
      setLoading(false)
    }
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

          {/* ── Tabs + main forms ── */}
          {tab === 'password' && subStep === 'otp' && (
            <>
              <div className="text-center mb-8">
                <h1 className="font-display font-bold text-2xl mb-2" style={{ letterSpacing: '-0.02em' }}>Check your email</h1>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Enter the 6-digit code sent to<br/>
                  <strong style={{ color: 'var(--text-primary)' }}>{email}</strong>
                </p>
              </div>
              <form onSubmit={verifyPasswordCode} className="space-y-4">
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
                  {loading ? 'Verifying...' : 'Verify & Sign In'}
                </button>
                <ResendTimer onResend={resendPasswordCode} />
                <button type="button" onClick={() => { setSubStep('form'); setEmailCode(''); setError('') }}
                  className="w-full py-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                  Back
                </button>
              </form>
            </>
          )}

          {!(tab === 'password' && subStep === 'otp') && (
            <>
              <div className="text-center mb-7">
                <h1 className="font-display font-bold text-2xl mb-1.5" style={{ letterSpacing: '-0.02em' }}>Welcome back</h1>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Sign in to your Synapse account</p>
              </div>

              {activated && (
                <div className="mb-4">
                  <NoticeBox msg={`Email activated${activationEmail ? ` for ${activationEmail}` : ''}. Sign in to continue.`} />
                </div>
              )}
              {activationStatus === 'invalid' && (
                <div className="mb-4">
                  <ErrorBox msg="That activation link is invalid or expired. Create the account again or request a new activation link." />
                </div>
              )}
              {activationStatus === 'failed' && (
                <div className="mb-4">
                  <ErrorBox msg="We could not activate this account. Contact Synapse OS support." />
                </div>
              )}

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
                  {error === ACTIVATION_REQUIRED_MESSAGE && (
                    <button
                      type="button"
                      onClick={() => resendActivation(email)}
                      className="w-full py-2 text-sm font-semibold"
                      style={{ color: 'var(--brand-orange)' }}
                    >
                      Resend activation email
                    </button>
                  )}
                  {notice && <NoticeBox msg={notice} />}
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

              {subStep === 'form' && (
                <p className="text-center text-sm mt-5" style={{ color: 'var(--text-muted)' }}>
                  Don&apos;t have an account?{' '}
                  <Link href="/signup" style={{ color: 'var(--brand-orange)', fontWeight: 600 }}>
                    Create account
                  </Link>
                </p>
              )}
            </>
          )}

          {/* Trust line */}
          <div className="mt-10 pt-6 flex items-center justify-center gap-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
            {['DPPA 2019', 'Encrypted', 'Audit-ready'].map(t => (
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
