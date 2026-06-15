'use client'

import { useState } from 'react'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { redeemInvite } from './actions'

interface Props {
  token:          string
  pharmacyName:   string
  adminName:      string
  adminEmail:     string
  profileExists:  boolean
}

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-elevated)',
  border:     '1px solid var(--border-edge)',
  color:      'var(--text-primary)',
}

export function RedeemInviteForm({ token, pharmacyName, adminName, adminEmail, profileExists }: Props) {
  const [showPass,    setShowPass]    = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [password,    setPassword]    = useState('')
  const [confirm,     setConfirm]     = useState('')
  const [name,        setName]        = useState(adminName)
  const [email,       setEmail]       = useState(adminEmail)
  const [error,       setError]       = useState('')
  const [pending,     setPending]     = useState(false)

  // When the profile exists the name/email are pre-filled from DB and locked.
  // When there's no profile (edge case: provisioning failed mid-way), the
  // admin enters their own details and the action creates the profile on the spot.
  const needsContact = !profileExists

  const strength = password.length === 0 ? null
    : password.length < 8  ? 'weak'
    : password.length < 12 ? 'fair'
    : /[A-Z]/.test(password) && /[0-9]/.test(password) ? 'strong'
    : 'fair'

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (needsContact && !name.trim())  { setError('Please enter your full name.'); return }
    if (needsContact && !email.trim()) { setError('Please enter your email address.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }
    if (password.length < 8)  { setError('Password must be at least 8 characters.'); return }

    setPending(true)
    setError('')

    const fd = new FormData()
    fd.set('token',           token)
    fd.set('password',        password)
    fd.set('confirmPassword', confirm)
    if (needsContact) {
      fd.set('adminName',  name.trim())
      fd.set('adminEmail', email.trim().toLowerCase())
    }

    const result = await redeemInvite(fd)
    if (result?.error) setError(result.error)
    setPending(false)
  }

  const submitDisabled = pending || password.length < 8 || password !== confirm
    || (needsContact && (!name.trim() || !email.trim()))

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Info card */}
      <div
        className="rounded-xl p-4 space-y-1.5 text-sm"
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
      >
        <div className="flex justify-between gap-2">
          <span style={{ color: 'var(--text-muted)' }}>Pharmacy</span>
          <span className="font-semibold text-right" style={{ color: 'var(--text-primary)' }}>{pharmacyName || '—'}</span>
        </div>

        {needsContact ? (
          <>
            <div className="pt-1">
              <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>
                Your full name
              </label>
              <input
                type="text"
                value={name}
                onChange={e => { setName(e.target.value); if (error) setError('') }}
                placeholder="e.g. Jane Nalubega"
                required
                autoFocus
                autoComplete="name"
                className="w-full rounded-lg px-3 py-2 text-sm outline-none transition-all"
                style={inputStyle}
                onFocus={e  => (e.target.style.borderColor = 'var(--brand-orange)')}
                onBlur={e   => (e.target.style.borderColor = 'var(--border-edge)')}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>
                Your email address
              </label>
              <input
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); if (error) setError('') }}
                placeholder="you@example.com"
                required
                autoComplete="email"
                className="w-full rounded-lg px-3 py-2 text-sm outline-none transition-all"
                style={inputStyle}
                onFocus={e  => (e.target.style.borderColor = 'var(--brand-orange)')}
                onBlur={e   => (e.target.style.borderColor = 'var(--border-edge)')}
              />
            </div>
          </>
        ) : (
          <>
            <div className="flex justify-between gap-2">
              <span style={{ color: 'var(--text-muted)' }}>Your name</span>
              <span className="font-semibold text-right" style={{ color: 'var(--text-primary)' }}>{adminName || '—'}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span style={{ color: 'var(--text-muted)' }}>Email</span>
              <span className="font-mono text-xs text-right" style={{ color: 'var(--text-secondary)' }}>{adminEmail || '—'}</span>
            </div>
          </>
        )}
      </div>

      {/* Password */}
      <div>
        <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>
          Set a password
        </label>
        <div className="relative">
          <input
            type={showPass ? 'text' : 'password'}
            value={password}
            onChange={e => { setPassword(e.target.value); if (error) setError('') }}
            placeholder="At least 8 characters"
            required
            autoFocus={!needsContact}
            autoComplete="new-password"
            className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all pr-11"
            style={inputStyle}
            onFocus={e  => (e.target.style.borderColor = 'var(--brand-orange)')}
            onBlur={e   => (e.target.style.borderColor = 'var(--border-edge)')}
          />
          <button
            type="button"
            onClick={() => setShowPass(v => !v)}
            aria-label={showPass ? 'Hide password' : 'Show password'}
            className="absolute right-3 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--text-muted)' }}
          >
            {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>

        {/* Strength bar */}
        {strength && (
          <div className="mt-2 flex items-center gap-2">
            <div className="flex flex-1 gap-1">
              {(['weak', 'fair', 'strong'] as const).map((level, i) => {
                const filled =
                  (strength === 'weak'   && i === 0) ||
                  (strength === 'fair'   && i <= 1) ||
                  (strength === 'strong' && i <= 2)
                return (
                  <div
                    key={level}
                    className="h-1 flex-1 rounded-full transition-all"
                    style={{
                      background: filled
                        ? strength === 'weak'   ? '#EF4444'
                          : strength === 'fair' ? '#F97316'
                          : '#22C55E'
                        : 'var(--border-subtle)',
                    }}
                  />
                )
              })}
            </div>
            <span className="text-[10px] font-semibold capitalize" style={{ color: strength === 'strong' ? '#22C55E' : strength === 'fair' ? '#F97316' : '#EF4444' }}>
              {strength}
            </span>
          </div>
        )}
      </div>

      {/* Confirm */}
      <div>
        <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>
          Confirm password
        </label>
        <div className="relative">
          <input
            type={showConfirm ? 'text' : 'password'}
            value={confirm}
            onChange={e => { setConfirm(e.target.value); if (error) setError('') }}
            placeholder="Re-enter password"
            required
            autoComplete="new-password"
            className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all pr-11"
            style={{
              ...inputStyle,
              borderColor: confirm && confirm !== password ? '#EF4444' : undefined,
            }}
            onFocus={e  => (e.target.style.borderColor = confirm && confirm !== password ? '#EF4444' : 'var(--brand-orange)')}
            onBlur={e   => (e.target.style.borderColor = confirm && confirm !== password ? '#EF4444' : 'var(--border-edge)')}
          />
          <button
            type="button"
            onClick={() => setShowConfirm(v => !v)}
            aria-label={showConfirm ? 'Hide password' : 'Show password'}
            className="absolute right-3 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--text-muted)' }}
          >
            {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {confirm && confirm !== password && (
          <p className="mt-1.5 text-xs" style={{ color: '#EF4444' }}>Passwords do not match</p>
        )}
      </div>

      {/* Error */}
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
        disabled={submitDisabled}
        className="w-full py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2"
        style={{
          background: 'var(--brand-orange)',
          color:      '#07070A',
          opacity:    submitDisabled ? 0.6 : 1,
        }}
      >
        {pending ? (
          <><Loader2 className="h-4 w-4 animate-spin" /> Setting up account…</>
        ) : (
          'Activate & Sign In'
        )}
      </button>

      <p className="text-center text-xs" style={{ color: 'var(--text-muted)' }}>
        You will be signed in automatically after setup.
      </p>
    </form>
  )
}
