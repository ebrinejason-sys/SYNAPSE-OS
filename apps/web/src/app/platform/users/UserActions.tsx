'use client'

import { useState, useTransition } from 'react'
import { sendPasswordResetForUser } from './actions'

type Props = {
  userId: string
  email: string
  role: string | null
}

const PHARMACY_URL =
  process.env.NEXT_PUBLIC_PHARMACY_URL ?? 'https://pharm.synapseos.tech'

export function UserActions({ userId, email, role }: Props) {
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [imitatePending, setImitatePending] = useState(false)

  const isPharmacyUser =
    role !== 'platform_admin' &&
    role !== 'superadmin' &&
    role !== null

  function onReset() {
    if (!confirm(`Send a password reset link to ${email}?`)) return
    setMessage(null)
    setError(null)

    startTransition(async () => {
      const fd = new FormData()
      fd.set('user_id', userId)
      fd.set('email', email)
      const result = await sendPasswordResetForUser(fd)
      if (result.ok) {
        setMessage(`Reset link sent to ${result.email}. Valid ~15 minutes.`)
      } else {
        setError(result.error ?? 'Could not send reset email.')
      }
    })
  }

  async function onImitate() {
    if (!confirm(`Open a 2-hour impersonation session as ${email}?`)) return
    setError(null)
    setImitatePending(true)
    try {
      const res = await fetch('/api/platform/impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: userId }),
      })
      const data = await res.json()
      if (!res.ok || !data.token) {
        setError(data.error ?? 'Could not start impersonation session.')
        return
      }
      // Open new tab, set cookie via a redirect endpoint, then open pharmacy portal
      const params = new URLSearchParams({ token: data.token })
      const tab = window.open(
        `${PHARMACY_URL}/api/auth/impersonate/start?${params}`,
        '_blank'
      )
      if (!tab) {
        setError('Pop-up blocked — allow pop-ups for this site and try again.')
      }
    } catch {
      setError('Network error — please try again.')
    } finally {
      setImitatePending(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1.5">
        {isPharmacyUser && (
          <button
            type="button"
            onClick={onImitate}
            disabled={imitatePending}
            className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-300 hover:border-amber-500/60 hover:text-amber-200 disabled:opacity-50"
          >
            {imitatePending ? 'Starting…' : 'Imitate'}
          </button>
        )}
        <button
          type="button"
          onClick={onReset}
          disabled={pending || !email}
          className="rounded-md border border-slate-700 bg-[#07070A] px-2.5 py-1 text-xs font-medium text-slate-200 hover:border-[#F97316]/40 hover:text-[#F97316] disabled:opacity-50"
        >
          {pending ? 'Sending…' : 'Reset password'}
        </button>
      </div>
      {role === 'platform_admin' ? (
        <span className="text-[10px] text-slate-600">Platform admin — imitate disabled</span>
      ) : null}
      {message ? <p className="max-w-[200px] text-right text-[10px] text-green-400">{message}</p> : null}
      {error ? <p className="max-w-[200px] text-right text-[10px] text-red-400">{error}</p> : null}
    </div>
  )
}
