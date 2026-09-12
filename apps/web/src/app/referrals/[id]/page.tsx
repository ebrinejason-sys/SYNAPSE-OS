'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useState } from 'react'

export default function ReferralDetailPage() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function act(action: 'accept' | 'reject' | 'complete' | 'cancel') {
    setBusy(true)
    setStatus(null)
    try {
      const res = await fetch('/api/facility/referral', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          action,
          reason: action === 'reject' ? 'No capacity' : undefined,
        }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || `Failed (${res.status})`)
      setStatus(`Now ${body.referral.status}`)
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="clinical-page mx-auto max-w-xl px-4 py-8">
      <Link href="/referrals" className="text-sm text-muted-color">
        ← Referrals
      </Link>
      <h1 className="mt-2 font-display text-2xl text-primary-color">Referral</h1>
      <p className="mt-1 font-mono text-xs text-muted-color">{id}</p>
      <div className="mt-6 flex flex-wrap gap-2">
        {(['accept', 'reject', 'complete', 'cancel'] as const).map((action) => (
          <button
            key={action}
            type="button"
            disabled={busy}
            onClick={() => void act(action)}
            className="rounded-xl border border-subtle px-3 py-2 text-sm capitalize text-primary-color disabled:opacity-40"
          >
            {action}
          </button>
        ))}
      </div>
      {status ? <p className="mt-4 text-sm text-secondary-color">{status}</p> : null}
    </main>
  )
}
