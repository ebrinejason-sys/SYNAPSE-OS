'use client'

import { useState, useTransition } from 'react'
import { acceptPlatformInvite } from './actions'

export function AcceptPlatformInviteForm({ token }: { token: string }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  return (
    <form
      action={(formData) => {
        startTransition(async () => {
          const result = await acceptPlatformInvite(formData)
          if (result?.error) setError(result.error)
        })
      }}
      className="space-y-4"
    >
      <input type="hidden" name="token" value={token} />
      <label className="block text-sm">
        <span className="text-slate-400">Password</span>
        <input name="password" type="password" required minLength={8} className="mt-1 w-full rounded-lg border border-slate-700 bg-black/40 px-3 py-2" />
      </label>
      <label className="block text-sm">
        <span className="text-slate-400">Confirm password</span>
        <input name="confirmPassword" type="password" required minLength={8} className="mt-1 w-full rounded-lg border border-slate-700 bg-black/40 px-3 py-2" />
      </label>
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-orange-500 py-2.5 text-sm font-semibold text-black disabled:opacity-60"
      >
        {pending ? 'Activating…' : 'Activate Access'}
      </button>
      <p className="text-xs text-slate-500 text-center">
        MFA enrollment may be required after first sign-in for your role.
      </p>
    </form>
  )
}
