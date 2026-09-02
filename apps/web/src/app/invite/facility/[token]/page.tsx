'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

export default function FacilityInviteRedeemPage() {
  const params = useParams<{ token: string }>()
  const router = useRouter()
  const token = params.token
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/invite/facility/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Invite redemption failed')
      router.push('/login?invited=1')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invite redemption failed')
      setLoading(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <h1 className="text-2xl font-bold">Set your hospital admin password</h1>
      <p className="mt-2 text-sm text-slate-400">Single-use invite. Choose a password to activate your account.</p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <label className="block space-y-1 text-sm">
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
            autoComplete="new-password"
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span>Confirm password</span>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
            autoComplete="new-password"
          />
        </label>
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-[#F97316] px-4 py-2 text-sm font-semibold text-[#07070A] disabled:opacity-50"
        >
          {loading ? 'Activating…' : 'Activate account'}
        </button>
      </form>
    </main>
  )
}
