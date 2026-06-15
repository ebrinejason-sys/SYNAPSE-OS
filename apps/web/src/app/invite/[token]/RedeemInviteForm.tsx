'use client'

import { useState } from 'react'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { redeemInvite } from './actions'

interface Props {
  token:        string
  pharmacyName: string
  adminName:    string
  adminEmail:   string
}

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-elevated)',
  border:     '1px solid var(--border-edge)',
  color:      'var(--text-primary)',
}

export function RedeemInviteForm({ token, pharmacyName, adminName, adminEmail }: Props) {
  const [showPass,    setShowPass]    = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [password,    setPassword]    = useState('')
  const [confirm,     setConfirm]     = useState('')
  const [error,       setError]       = useState('')
  const [pending,     setPending]     = useState(false)

  const strength = password.length === 0 ? null
    : password.length < 8  ? 'weak'
    : password.length < 12 ? 'fair'
    : /[A-Z]/.test(password) && /[0-9]/.test(password) ? 'strong'
    : 'fair'

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (password !== confirm) { setError('Passwords do not match.'); return }
    if (password.length < 8)  { setError('Password must be at least 8 characters.'); return }

    setPending(true)
    setError('')

    const fd = new FormData()
    fd.set('token',           token)
    fd.set('password',        password)
    fd.set('confirmPassword', confirm)

    const result = await redeemInvite(fd)
    // redeemInvite redirects on success — if we're still here there was an error
    if (result?.error) setError(result.error)
    setPending(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Read-only info */}
      <div
        className="rounded-xl p-4 space-y-1.5 text-sm"
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
      >
        <div className="flex justify-between gap-2">
          <span style={{ color: 'var(--text-muted)' }}>Pharmacy</span>
          <span className="font-semibold text-right" style={{ color: 'var(--text-primary)' }}>{pharmacyName || '—'}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span style={{ color: 'var(--text-muted)' }}>Your name</span>
          <span className="font-semibold text-right" style={{ color: 'var(--text-primary)' }}>{adminName || '—'}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span style={{ color: 'var(--text-muted)' }}>Email</span>
          <span className="font-mono text-xs text-right" style={{ color: 'var(--text-secondary)' }}>{adminEmail || '—'}</span>
        </div>
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
            autoFocus
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
        disabled={pending || password.length < 8 || password !== confirm}
        className="w-full py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2"
        style={{
          background: 'var(--brand-orange)',
          color:      '#07070A',
          opacity:    pending || password.length < 8 || password !== confirm ? 0.6 : 1,
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
