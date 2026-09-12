'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

type Referral = {
  id: string
  status: string
  speciality: string
  urgency: string
  clinicalSummary: string
  toTenantId: string
  fromTenantId: string
  createdAt: string
}

export default function ReferralsPage() {
  const [direction, setDirection] = useState<'outgoing' | 'incoming'>('outgoing')
  const [items, setItems] = useState<Referral[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/facility/referral?direction=${direction}`)
        const body = await res.json()
        if (!res.ok) throw new Error(body.error || `Failed (${res.status})`)
        if (!cancelled) setItems(body.referrals ?? [])
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [direction])

  return (
    <main className="clinical-page mx-auto max-w-3xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl text-primary-color">Referrals</h1>
        <Link
          href="/referrals/new"
          className="rounded-xl bg-[var(--brand-orange)] px-4 py-2 text-sm font-medium text-white"
        >
          New referral
        </Link>
      </div>
      <div className="mt-4 flex gap-2">
        {(['outgoing', 'incoming'] as const).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDirection(d)}
            className={`rounded-xl border px-3 py-1.5 text-sm ${
              direction === d ? 'border-strong bg-elevated' : 'border-subtle'
            }`}
          >
            {d}
          </button>
        ))}
      </div>
      {loading ? <p className="mt-6 text-sm text-muted-color">Loading…</p> : null}
      {error ? <p className="mt-6 text-sm text-red-500">{error}</p> : null}
      <div className="mt-6 grid gap-3">
        {items.map((r) => (
          <Link key={r.id} href={`/referrals/${r.id}`} className="clinical-card block p-4">
            <div className="flex justify-between gap-3 text-sm">
              <span className="font-medium text-primary-color">{r.speciality}</span>
              <span className="text-muted-color">{r.status}</span>
            </div>
            <p className="mt-1 text-sm text-secondary-color line-clamp-2">{r.clinicalSummary}</p>
            <p className="mt-2 text-xs text-muted-color">
              {r.urgency} · {new Date(r.createdAt).toLocaleString()}
            </p>
          </Link>
        ))}
        {!loading && !error && items.length === 0 ? (
          <p className="text-sm text-muted-color">No {direction} referrals yet.</p>
        ) : null}
      </div>
    </main>
  )
}
