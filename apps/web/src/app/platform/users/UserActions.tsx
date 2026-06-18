'use client'

import { useState, useTransition } from 'react'
import { sendPasswordResetForUser } from './actions'

type Props = {
  userId: string
  email: string
  role: string | null
}

export function UserActions({ userId, email, role }: Props) {
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

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

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onReset}
        disabled={pending || !email}
        className="rounded-md border border-slate-700 bg-[#07070A] px-2.5 py-1 text-xs font-medium text-slate-200 hover:border-[#F97316]/40 hover:text-[#F97316] disabled:opacity-50"
      >
        {pending ? 'Sending…' : 'Reset password'}
      </button>
      {role === 'platform_admin' ? (
        <span className="text-[10px] text-slate-600">Admin → /platform after reset</span>
      ) : null}
      {message ? <p className="max-w-[200px] text-right text-[10px] text-green-400">{message}</p> : null}
      {error ? <p className="max-w-[200px] text-right text-[10px] text-red-400">{error}</p> : null}
    </div>
  )
}
