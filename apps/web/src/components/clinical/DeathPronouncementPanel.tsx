'use client'

import { useState } from 'react'

export function DeathPronouncementPanel({
  encounterId,
  patientId,
}: {
  encounterId?: string | null
  patientId?: string | null
}) {
  const [precision, setPrecision] = useState<'EXACT' | 'ESTIMATED' | 'UNKNOWN'>('EXACT')
  const [deathDateTime, setDeathDateTime] = useState('')
  const [deathTimeText, setDeathTimeText] = useState('')
  const [locationType, setLocationType] = useState('ward')
  const [provisionalCause, setProvisionalCause] = useState('')
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function pronounce() {
    if (!encounterId || !patientId) {
      setError('Open an encounter before pronouncing death.')
      return
    }
    setError(null)
    const res = await fetch('/api/clinical/death-pronouncements', {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        patient_id: patientId,
        encounter_id: encounterId,
        death_time_precision: precision,
        death_date_time: precision === 'UNKNOWN' ? null : (deathDateTime ? new Date(deathDateTime).toISOString() : null),
        death_time_text: deathTimeText || (precision === 'UNKNOWN' ? 'date known, exact time unknown' : null),
        location_type: locationType,
        provisional_cause: provisionalCause || null,
        findings: { noPulse: true, noRespiratoryEffort: true },
      }),
    })
    const json = await res.json()
    if (!res.ok) {
      setError(typeof json.error === 'string' ? json.error : 'Pronouncement failed')
      return
    }
    setResult(json.pronouncement.id)
  }

  return (
    <section className="clinical-card mt-6 p-4" aria-labelledby="death-heading">
      <h2 id="death-heading" className="font-display text-lg">Death pronouncement</h2>
      <p className="mt-1 text-xs text-muted-color">Clinical determination only. Cause-of-death certification is a separate permission. AI cannot pronounce.</p>
      {error ? <p className="mt-3 text-sm text-amber-300">{error}</p> : null}
      {result ? <p className="mt-3 text-sm text-emerald-300">Pronouncement recorded. Mortuary handoff can start.</p> : null}
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <label className="text-xs">
          Time precision
          <select className="mt-1 w-full rounded border border-border bg-transparent p-2" value={precision} onChange={(event) => setPrecision(event.target.value as typeof precision)}>
            <option value="EXACT">EXACT</option>
            <option value="ESTIMATED">ESTIMATED</option>
            <option value="UNKNOWN">UNKNOWN</option>
          </select>
        </label>
        <label className="text-xs">
          Time of death
          <input className="mt-1 w-full rounded border border-border bg-transparent p-2" type="datetime-local" value={deathDateTime} onChange={(event) => setDeathDateTime(event.target.value)} disabled={precision === 'UNKNOWN'} />
        </label>
        <label className="text-xs md:col-span-2">
          Estimate / unknown reason
          <input className="mt-1 w-full rounded border border-border bg-transparent p-2" value={deathTimeText} onChange={(event) => setDeathTimeText(event.target.value)} placeholder="approximately 03:30 or date known, exact time unknown" />
        </label>
        <label className="text-xs">
          Location
          <select className="mt-1 w-full rounded border border-border bg-transparent p-2" value={locationType} onChange={(event) => setLocationType(event.target.value)}>
            <option value="ward">Ward</option>
            <option value="emergency">Emergency</option>
            <option value="icu">ICU</option>
            <option value="theatre">Theatre</option>
            <option value="arrival">Death on arrival</option>
          </select>
        </label>
        <label className="text-xs">
          Provisional cause
          <input className="mt-1 w-full rounded border border-border bg-transparent p-2" value={provisionalCause} onChange={(event) => setProvisionalCause(event.target.value)} />
        </label>
      </div>
      <button type="button" className="mt-4 rounded bg-[#F97316] px-3 py-2 text-sm font-medium text-black" onClick={() => void pronounce()}>
        Pronounce death
      </button>
    </section>
  )
}
