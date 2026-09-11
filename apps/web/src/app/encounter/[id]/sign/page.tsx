'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useState } from 'react'

export default function EncounterSignPage() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function sign() {
    setBusy(true)
    setStatus(null)
    try {
      const res = await fetch(`/api/opd/encounters/${id}/sign`, { method: 'POST' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setStatus(body.error || `Sign failed (${res.status})`)
        return
      }
      setStatus('Encounter signed.')
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Sign failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="clinical-page mx-auto max-w-xl px-4 py-8">
      <Link href={`/encounter/${id}`} className="text-sm text-muted-color">
        ← Encounter
      </Link>
      <h1 className="mt-2 font-display text-2xl text-primary-color">Sign encounter</h1>
      <p className="mt-2 text-sm text-secondary-color">
        Signing locks the clinical note. Further changes require an amendment with reason.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => void sign()}
          className="rounded-xl bg-[var(--brand-orange)] px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          {busy ? 'Signing…' : 'Sign encounter'}
        </button>
        <Link
          href={`/encounter/${id}/notes`}
          className="rounded-xl border border-subtle px-4 py-2 text-sm text-primary-color"
        >
          Review write-up
        </Link>
      </div>
      {status ? <p className="mt-4 text-sm text-secondary-color">{status}</p> : null}
    </main>
  )
}
