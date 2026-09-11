'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useState } from 'react'

const DISPOSITIONS = [
  { value: 'LOCAL_PHARMACY', label: 'Local pharmacy' },
  { value: 'EXTERNAL_PHARMACY', label: 'External pharmacy' },
  { value: 'NO_MEDICATION', label: 'No medication' },
  { value: 'FURTHER_LAB', label: 'Further lab' },
  { value: 'REFERRAL', label: 'Referral' },
  { value: 'FOLLOW_UP', label: 'Follow-up' },
  { value: 'CLINICAL_COMPLETE', label: 'Clinical complete' },
] as const

export default function EncounterDispositionPage() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const [disposition, setDisposition] = useState<string>('CLINICAL_COMPLETE')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  async function submit() {
    setBusy(true)
    setStatus(null)
    try {
      const res = await fetch(`/api/opd/encounters/${id}/disposition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ disposition, reason: reason.trim() || undefined }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setStatus(body.error || `Failed (${res.status})`)
        return
      }
      setStatus(
        body.alreadyRecorded
          ? `Already recorded: ${body.disposition}`
          : `Recorded ${body.disposition}`,
      )
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="clinical-page mx-auto max-w-xl px-4 py-8">
      <Link href={`/encounter/${id}`} className="text-sm text-muted-color">
        ← Encounter
      </Link>
      <h1 className="mt-2 font-display text-2xl text-primary-color">Disposition</h1>
      <p className="mt-2 text-sm text-secondary-color">
        Required before encounter close. Local pharmacy needs an active prescription.
      </p>

      <label className="clinical-card mt-6 block p-4">
        <span className="text-sm font-medium text-primary-color">Disposition</span>
        <select
          className="mt-2 w-full rounded-xl border border-subtle bg-base px-3 py-2 text-sm text-primary-color"
          value={disposition}
          onChange={(e) => setDisposition(e.target.value)}
          disabled={busy}
        >
          {DISPOSITIONS.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
      </label>

      <label className="clinical-card mt-3 block p-4">
        <span className="text-sm font-medium text-primary-color">Reason (optional)</span>
        <textarea
          className="mt-2 w-full rounded-xl border border-subtle bg-base px-3 py-2 text-sm text-primary-color"
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          disabled={busy}
        />
      </label>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => void submit()}
          className="rounded-xl bg-[var(--brand-orange)] px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          {busy ? 'Saving…' : 'Record disposition'}
        </button>
        <Link
          href={`/encounter/${id}/sign`}
          className="rounded-xl border border-subtle px-4 py-2 text-sm text-primary-color"
        >
          Sign
        </Link>
      </div>
      {status ? <p className="mt-4 text-sm text-secondary-color">{status}</p> : null}
    </main>
  )
}
