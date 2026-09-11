'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'

type LookupOk = {
  ok: true
  email: string
  tenantName: string
  hasExistingAccount: boolean
}

type LookupErr = {
  ok: false
  code?: string
  error?: string
}

export default function FacilityInviteRedeemPage() {
  const params = useParams<{ token: string }>()
  const router = useRouter()
  const token = params.token
  const [lookup, setLookup] = useState<LookupOk | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError('')
      try {
        const res = await fetch(`/api/invite/facility/lookup?token=${encodeURIComponent(token)}`)
        const data = (await res.json()) as LookupOk | LookupErr
        if (!res.ok || data.ok !== true) {
          if (!cancelled) setError(data.error || 'Invalid invitation')
          return
        }
        if (!cancelled) setLookup(data)
      } catch {
        if (!cancelled) setError('Could not load invitation')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [token])

  async function acceptExisting() {
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/invite/facility/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const data = await res.json()
      if (res.status === 401) {
        router.push(`/login?next=${encodeURIComponent(`/invite/facility/${token}`)}`)
        return
      }
      if (!res.ok) throw new Error(data.error || 'Could not accept invitation')
      router.push('/login?invited=1')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not accept invitation')
      setSubmitting(false)
    }
  }

  async function registerNew(e: FormEvent) {
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
    setSubmitting(true)
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
      setSubmitting(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <h1 className="text-2xl font-bold">Facility invitation</h1>
      {loading ? <p className="mt-2 text-sm text-slate-400">Checking invitation…</p> : null}
      {!loading && error && !lookup ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}
      {lookup ? (
        <>
          <p className="mt-2 text-sm text-slate-400">
            You&apos;re invited to <span className="text-slate-200">{lookup.tenantName || 'a facility'}</span> as{" "}
            <span className="text-slate-200">{lookup.email}</span>.
          </p>
          {lookup.hasExistingAccount ? (
            <div className="mt-6 space-y-4">
              <p className="text-sm text-slate-400">
                An account already exists for this email. Sign in, then accept to add this facility to your access.
              </p>
              {error ? <p className="text-sm text-red-400">{error}</p> : null}
              <button
                type="button"
                disabled={submitting}
                onClick={() => void acceptExisting()}
                className="w-full rounded-lg bg-[#F97316] px-4 py-2 text-sm font-semibold text-[#07070A] disabled:opacity-50"
              >
                {submitting ? 'Accepting…' : 'Accept invitation'}
              </button>
              <p className="text-xs text-slate-500">
                Not signed in?{" "}
                <Link className="text-[#F97316] underline" href={`/login?next=${encodeURIComponent(`/invite/facility/${token}`)}`}>
                  Sign in first
                </Link>
                .
              </p>
            </div>
          ) : (
            <form onSubmit={registerNew} className="mt-6 space-y-4">
              <p className="text-sm text-slate-400">Choose a password to activate your account. This link is single-use.</p>
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
                disabled={submitting}
                className="w-full rounded-lg bg-[#F97316] px-4 py-2 text-sm font-semibold text-[#07070A] disabled:opacity-50"
              >
                {submitting ? 'Activating…' : 'Activate account'}
              </button>
            </form>
          )}
        </>
      ) : null}
    </main>
  )
}
