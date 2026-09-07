'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function FacilityInviteForm({ token, pharmacyName, email }: { token: string; pharmacyName: string; email: string }) {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    if (password.length < 8) return setError('Password must be at least 8 characters.')
    if (password !== confirm) return setError('Passwords do not match.')
    setBusy(true)
    const response = await fetch('/api/invite/facility/redeem', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token, password }) })
    const data = await response.json().catch(() => ({})) as { error?: string; redirectTo?: string }
    if (!response.ok) {
      setError(data.error ?? 'Could not activate this account.')
      setBusy(false)
      return
    }
    router.push(data.redirectTo ?? '/onboarding')
    router.refresh()
  }

  return (
    <form onSubmit={submit} className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-xl">
      <img src="/logo.png" alt="SynapseOS" className="mx-auto mb-4 h-16 w-16 rounded-2xl object-contain" />
      <h1 className="text-center text-2xl font-bold">Activate your pharmacy account</h1>
      <p className="mt-2 text-center text-sm text-muted-foreground">{pharmacyName}</p>
      <div className="mt-6 rounded-lg border border-border bg-muted px-3 py-2 text-sm">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">Email</span>
        <p className="mt-0.5 break-all">{email}</p>
      </div>
      <label className="mt-4 block text-sm">Password
        <input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2" required minLength={8} />
      </label>
      <label className="mt-4 block text-sm">Confirm password
        <input type="password" autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2" required minLength={8} />
      </label>
      {error ? <p className="mt-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}
      <button type="submit" disabled={busy} className="mt-6 w-full rounded-lg bg-primary px-4 py-2.5 font-semibold text-primary-foreground disabled:opacity-60">
        {busy ? 'Activating…' : 'Activate account'}
      </button>
    </form>
  )
}
