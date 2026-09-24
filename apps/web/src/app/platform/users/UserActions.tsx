'use client'

import { useState, useTransition } from 'react'
import {
  activateUserAccount,
  deactivateUserAccount,
  revokeUserSessions,
  sendPasswordResetForUser,
} from './actions'

type Props = {
  userId: string
  email: string
  role: string | null
  emailVerified: boolean
  isDeleted: boolean
}

const PHARMACY_URL =
  process.env.NEXT_PUBLIC_PHARMACY_URL ?? 'https://pharm.synapseos.tech'

export function UserActions({ userId, email, role, emailVerified, isDeleted }: Props) {
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [imitatePending, setImitatePending] = useState(false)

  const isPharmacyUser =
    role !== 'platform_admin' &&
    role !== 'superadmin' &&
    role !== null

  function run(action: () => Promise<{ ok: boolean; error?: string; email?: string }>, success: string) {
    setMessage(null)
    setError(null)
    startTransition(async () => {
      const result = await action()
      if (result.ok) setMessage(success)
      else setError(result.error ?? 'Action failed.')
    })
  }

  function onReset() {
    if (!confirm(`Send a password reset link to ${email}?`)) return
    run(async () => {
      const fd = new FormData()
      fd.set('user_id', userId)
      fd.set('email', email)
      return sendPasswordResetForUser(fd)
    }, `Reset link sent to ${email}. Valid ~15 minutes.`)
  }

  function onActivate() {
    run(async () => {
      const fd = new FormData()
      fd.set('user_id', userId)
      return activateUserAccount(fd)
    }, 'Account activated (email verified). Login guards still apply.')
  }

  function onDeactivate() {
    const reason = window.prompt('Reason for deactivating this account (required):')
    if (!reason?.trim()) return
    if (!confirm(`Deactivate ${email}? Historical records keep attribution.`)) return
    run(async () => {
      const fd = new FormData()
      fd.set('user_id', userId)
      fd.set('reason', reason.trim())
      return deactivateUserAccount(fd)
    }, 'Account deactivated. Sessions revoked.')
  }

  function onRevokeSessions() {
    if (!confirm(`Revoke all sessions for ${email}?`)) return
    run(async () => {
      const fd = new FormData()
      fd.set('user_id', userId)
      return revokeUserSessions(fd)
    }, 'Sessions revoked.')
  }

  async function onImpersonate() {
    if (!confirm(`Open a 2-hour impersonation session as ${email}?`)) return
    setError(null)
    setImitatePending(true)
    const tab = window.open('', '_blank')
    if (!tab) {
      setError('Pop-up blocked — allow pop-ups for this site and try again.')
      setImitatePending(false)
      return
    }
    try {
      const res = await fetch('/api/platform/impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: userId }),
      })
      const data = await res.json()
      if (!res.ok || !data.token) {
        tab.close()
        setError(data.error ?? 'Could not start impersonation session.')
        return
      }
      const params = new URLSearchParams({ token: data.token })
      tab.location.href = `${PHARMACY_URL}/api/auth/impersonate/start?${params}`
    } catch {
      tab.close()
      setError('Network error — please try again.')
    } finally {
      setImitatePending(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap items-center justify-end gap-1.5" role="group" aria-label={`Actions for ${email}`}>
        {!emailVerified && !isDeleted ? (
          <button
            type="button"
            onClick={onActivate}
            disabled={pending}
            className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-300 hover:border-emerald-500/60 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
          >
            Activate
          </button>
        ) : null}
        {isPharmacyUser && !isDeleted ? (
          <button
            type="button"
            onClick={onImpersonate}
            disabled={imitatePending}
            className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-300 hover:border-amber-500/60 hover:text-amber-200 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
          >
            {imitatePending ? 'Starting…' : 'Impersonate'}
          </button>
        ) : null}
        <button
          type="button"
          onClick={onRevokeSessions}
          disabled={pending || isDeleted}
          className="rounded-md border border-slate-700 bg-[#07070A] px-2.5 py-1 text-xs font-medium text-slate-200 hover:border-slate-500 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E8B84B]"
        >
          Revoke sessions
        </button>
        <button
          type="button"
          onClick={onReset}
          disabled={pending || !email || isDeleted}
          className="rounded-md border border-slate-700 bg-[#07070A] px-2.5 py-1 text-xs font-medium text-slate-200 hover:border-[#F97316]/40 hover:text-[#F97316] disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E8B84B]"
        >
          {pending ? 'Working…' : 'Reset password'}
        </button>
        {!isDeleted ? (
          <button
            type="button"
            onClick={onDeactivate}
            disabled={pending}
            className="rounded-md border border-red-500/30 px-2.5 py-1 text-xs font-medium text-red-300 hover:bg-red-500/10 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400"
          >
            Deactivate
          </button>
        ) : (
          <span className="text-[10px] text-slate-500">Archived</span>
        )}
      </div>
      {role === 'platform_admin' ? (
        <span className="text-[10px] text-slate-600">Platform admin — impersonation disabled</span>
      ) : null}
      {message ? <p className="max-w-[240px] text-right text-[10px] text-green-400" role="status">{message}</p> : null}
      {error ? <p className="max-w-[240px] text-right text-[10px] text-red-400" role="alert">{error}</p> : null}
    </div>
  )
}
