'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff } from 'lucide-react'
import { setupAccount } from './actions'

interface Props {
  token:         string
  pharmacyName:  string
  adminEmail:    string
  adminName:     string
  profileExists: boolean
}

export function InviteForm({ token, pharmacyName, adminEmail, adminName, profileExists }: Props) {
  const router = useRouter()

  const [fullName,         setFullName]         = useState(adminName)
  const [email,            setEmail]            = useState(adminEmail)
  const [password,         setPassword]         = useState('')
  const [confirmPassword,  setConfirmPassword]  = useState('')
  const [showPassword,     setShowPassword]     = useState(false)
  const [showConfirm,      setShowConfirm]      = useState(false)
  const [submitting,       setSubmitting]       = useState(false)
  const [error,            setError]            = useState<string | null>(null)

  // When profile exists: name/email pre-filled from DB (read-only email, editable name)
  // When no profile: user enters both name and email
  const needsEmail = !profileExists && !adminEmail

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (fullName.trim().length < 2)  { setError('Please enter your full name.'); return }
    if (needsEmail && !email.trim()) { setError('Please enter your email address.'); return }
    if (password.length < 8)         { setError('Password must be at least 8 characters.'); return }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return }

    setSubmitting(true)
    const result = await setupAccount(
      token,
      fullName.trim(),
      password,
      needsEmail ? email.trim() : undefined
    )

    if (!result.success) {
      setError(result.error ?? 'An unexpected error occurred.')
      setSubmitting(false)
      return
    }

    router.push('/onboarding')
    router.refresh()
  }

  const inputCls = 'w-full bg-[#1A1A24] border border-[#2A2A36] rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:border-[#F97316] focus:outline-none disabled:opacity-50 transition-colors'
  const labelCls = 'text-xs font-medium uppercase tracking-wider text-zinc-400'

  return (
    <>
      <div className="mb-6 text-center">
        <h2 className="text-white font-bold text-xl mb-1">Set up your account</h2>
        <p className="text-[#E8B84B] text-sm font-medium">{pharmacyName}</p>
      </div>

      {/* Show pre-filled email as info whenever email is known (profile exists or stored in onboarding) */}
      {adminEmail && !needsEmail && (
        <div className="mb-4 bg-[#1A1A24] border border-[#2A2A36] rounded-lg px-3 py-2.5 text-sm">
          <span className="text-zinc-500 text-xs uppercase tracking-wider font-medium">Email</span>
          <p className="text-zinc-300 mt-0.5">{adminEmail}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Email — only shown when no profile and no stored email */}
        {needsEmail && (
          <label className="block space-y-1.5">
            <span className={labelCls}>Email address</span>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={submitting}
              autoComplete="email"
              className={inputCls}
            />
          </label>
        )}

        <label className="block space-y-1.5">
          <span className={labelCls}>Full Name</span>
          <input
            type="text"
            placeholder="Jane Nakato"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            disabled={submitting}
            autoComplete="name"
            className={inputCls}
          />
        </label>

        <label className="block space-y-1.5">
          <span className={labelCls}>Password</span>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Min 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              disabled={submitting}
              autoComplete="new-password"
              className={inputCls + ' pr-10'}
            />
            <button type="button" tabIndex={-1} onClick={() => setShowPassword(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors">
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </label>

        <label className="block space-y-1.5">
          <span className={labelCls}>Confirm Password</span>
          <div className="relative">
            <input
              type={showConfirm ? 'text' : 'password'}
              placeholder="Re-enter password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={submitting}
              autoComplete="new-password"
              className={inputCls + ' pr-10'}
            />
            <button type="button" tabIndex={-1} onClick={() => setShowConfirm(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors">
              {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </label>

        {error && (
          <p className="text-red-400 bg-red-500/10 rounded-lg px-3 py-2 text-sm">{error}</p>
        )}

        <button type="submit" disabled={submitting}
          className="w-full bg-[#F97316] hover:bg-orange-600 text-white rounded-lg py-2.5 font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed mt-2 flex items-center justify-center gap-2">
          {submitting ? (
            <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Creating Account…</>
          ) : 'Create Account'}
        </button>
      </form>

      <p className="text-center text-xs mt-6 text-zinc-600">
        Synapse Health Technologies &copy; {new Date().getFullYear()}
      </p>
    </>
  )
}
