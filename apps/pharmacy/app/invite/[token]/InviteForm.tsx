'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff } from 'lucide-react'
import { setupAccount } from './actions'

export function InviteForm({ token, pharmacyName }: { token: string; pharmacyName: string }) {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (fullName.trim().length < 2) { setError('Please enter your full name.'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return }

    setSubmitting(true)
    const result = await setupAccount(token, fullName.trim(), password)

    if (!result.success) {
      setError(result.error ?? 'An unexpected error occurred.')
      setSubmitting(false)
      return
    }

    router.push('/onboarding')
    router.refresh()
  }

  return (
    <>
      <div className="mb-6 text-center">
        <h2 className="text-white font-bold text-xl mb-1">Set up your account</h2>
        <p className="text-[#E8B84B] text-sm font-medium">{pharmacyName}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">Full Name</span>
          <input
            type="text"
            placeholder="Jane Nakato"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            disabled={submitting}
            className="w-full bg-[#1A1A24] border border-[#2A2A36] rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:border-[#F97316] focus:outline-none disabled:opacity-50 transition-colors"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">Password</span>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Min 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              disabled={submitting}
              className="w-full bg-[#1A1A24] border border-[#2A2A36] rounded-lg px-3 py-2.5 pr-10 text-sm text-white placeholder-zinc-600 focus:border-[#F97316] focus:outline-none disabled:opacity-50 transition-colors"
            />
            <button type="button" tabIndex={-1} onClick={() => setShowPassword(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors">
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">Confirm Password</span>
          <div className="relative">
            <input
              type={showConfirm ? 'text' : 'password'}
              placeholder="Re-enter password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={submitting}
              className="w-full bg-[#1A1A24] border border-[#2A2A36] rounded-lg px-3 py-2.5 pr-10 text-sm text-white placeholder-zinc-600 focus:border-[#F97316] focus:outline-none disabled:opacity-50 transition-colors"
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
