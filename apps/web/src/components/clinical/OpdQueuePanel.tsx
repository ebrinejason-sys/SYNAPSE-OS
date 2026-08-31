'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'

export type QueueRow = {
  encounterId: string
  patientId: string
  fullName: string
  mrn: string | null
  chiefComplaint: string | null
  clinicalStage: string | null
  status: string
  visitDate: string
}

type OpdQueuePanelProps = {
  slug: string
}

export function OpdQueuePanel({ slug }: OpdQueuePanelProps) {
  const [queue, setQueue] = useState<QueueRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [signingId, setSigningId] = useState<string | null>(null)

  const loadQueue = useCallback(async () => {
    const res = await fetch('/api/opd/queue', { credentials: 'include' })
    if (!res.ok) {
      setError('Sign in as hospital clinical staff to view the OPD queue.')
      return
    }
    const data = await res.json()
    setQueue(data.queue ?? [])
    setError(null)
  }, [])

  useEffect(() => {
    loadQueue().catch(() => setError('Unable to load queue'))
  }, [loadQueue])

  async function signEncounter(encounterId: string) {
    setSigningId(encounterId)
    try {
      const res = await fetch(`/api/opd/encounters/${encounterId}/sign`, {
        method: 'POST',
        credentials: 'include',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(typeof data.error === 'string' ? data.error : 'Sign failed')
        return
      }
      await loadQueue()
    } finally {
      setSigningId(null)
    }
  }

  return (
    <div>
      <h1 className="font-display text-2xl">OPD queue</h1>
      <p className="mt-2 text-sm text-muted-color">
        Today&apos;s encounters — triage, orders, sign notes, and view the care spine timeline.
      </p>
      {error ? <p className="mt-4 text-sm text-amber-300">{error}</p> : null}
      <ul className="mt-8 space-y-3">
        {queue.map((row) => (
          <li key={row.encounterId} className="clinical-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium">{row.fullName}</p>
                <p className="text-xs text-muted-color">
                  {row.mrn ?? 'No MRN'} · {row.status} · {row.clinicalStage ?? 'unclassified'}
                </p>
                <p className="mt-1 text-sm text-secondary-color">{row.chiefComplaint ?? 'No complaint'}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/os/${slug}/encounters/new?patientId=${row.patientId}`}
                  className="rounded-lg border border-emerald-500/40 px-3 py-1 text-xs text-emerald-300"
                >
                  Encounter
                </Link>
                <Link
                  href={`/os/${slug}/clinical/orders?encounterId=${row.encounterId}&patientId=${row.patientId}`}
                  className="rounded-lg border border-indigo-500/40 px-3 py-1 text-xs text-indigo-300"
                >
                  Orders & timeline
                </Link>
                {row.status !== 'signed' ? (
                  <button
                    type="button"
                    disabled={signingId === row.encounterId}
                    onClick={() => signEncounter(row.encounterId)}
                    className="rounded-lg border border-amber-500/40 px-3 py-1 text-xs text-amber-300 disabled:opacity-50"
                  >
                    {signingId === row.encounterId ? 'Signing…' : 'Sign note'}
                  </button>
                ) : null}
                {row.status === 'signed' ? (
                  <button
                    type="button"
                    disabled={signingId === row.encounterId}
                    onClick={async () => {
                      const newValue = window.prompt('Amended chief complaint:')
                      if (!newValue?.trim()) return
                      const reason = window.prompt('Amendment reason (required):')
                      if (!reason?.trim()) return
                      setSigningId(row.encounterId)
                      try {
                        const res = await fetch(`/api/opd/encounters/${row.encounterId}/amend`, {
                          method: 'POST',
                          credentials: 'include',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            field: 'chief_complaint',
                            new_value: newValue.trim(),
                            reason: reason.trim(),
                          }),
                        })
                        if (!res.ok) {
                          const data = await res.json().catch(() => ({}))
                          setError(typeof data.error === 'string' ? data.error : 'Amend failed')
                          return
                        }
                        await loadQueue()
                      } finally {
                        setSigningId(null)
                      }
                    }}
                    className="rounded-lg border border-violet-500/40 px-3 py-1 text-xs text-violet-300 disabled:opacity-50"
                  >
                    Amend note
                  </button>
                ) : null}
              </div>
            </div>
          </li>
        ))}
        {queue.length === 0 && !error ? (
          <p className="text-sm text-muted-color">No open encounters today.</p>
        ) : null}
      </ul>
    </div>
  )
}
