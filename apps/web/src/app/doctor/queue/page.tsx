'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'

type QueueRow = {
  encounterId: string
  patientId: string
  fullName: string
  mrn: string | null
  chiefComplaint: string | null
  clinicalStage: string | null
  status: string
  visitDate: string
}

export default function DoctorQueuePage() {
  const [queue, setQueue] = useState<QueueRow[]>([])
  const [tenantSlug, setTenantSlug] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [signingId, setSigningId] = useState<string | null>(null)

  const loadQueue = useCallback(async () => {
    const [queueRes, meRes] = await Promise.all([
      fetch('/api/opd/queue', { credentials: 'include' }),
      fetch('/api/auth/me', { credentials: 'include' }),
    ])
    if (!queueRes.ok) {
      setError('Sign in as hospital clinical staff to view the OPD queue.')
      return
    }
    const data = await queueRes.json()
    setQueue(data.queue ?? [])
    setError(null)
    if (meRes.ok) {
      const me = await meRes.json()
      setTenantSlug(me.user?.tenantSlug ?? null)
    }
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
    <main className="min-h-screen bg-base text-primary-color p-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="font-display text-2xl">OPD Patient Queue</h1>
        <p className="mt-2 text-sm text-muted-color">
          Today&apos;s encounters for your hospital tenant — sign notes and place orders from here.
        </p>
        {error ? <p className="mt-4 text-sm text-amber-300">{error}</p> : null}
        <ul className="mt-8 space-y-3">
          {queue.map((row) => (
            <li key={row.encounterId} className="rounded-2xl border border-subtle bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{row.fullName}</p>
                  <p className="text-xs text-muted-color">
                    {row.mrn ?? 'No MRN'} · {row.status} · {row.clinicalStage ?? 'unclassified'}
                  </p>
                  <p className="mt-1 text-sm text-secondary-color">{row.chiefComplaint ?? 'No complaint'}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {tenantSlug ? (
                    <Link
                      href={`/os/${tenantSlug}/encounters/new?patientId=${row.patientId}`}
                      className="rounded-lg border border-emerald-500/40 px-3 py-1 text-xs text-emerald-300"
                    >
                      Open encounter
                    </Link>
                  ) : null}
                  <Link
                    href={`/doctor/orders?encounterId=${row.encounterId}&patientId=${row.patientId}`}
                    className="rounded-lg border border-indigo-500/40 px-3 py-1 text-xs text-indigo-300"
                  >
                    Orders
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
    </main>
  )
}
