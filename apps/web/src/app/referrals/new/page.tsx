'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function NewReferralPage() {
  const router = useRouter()
  const [toTenantId, setToTenantId] = useState('')
  const [patientId, setPatientId] = useState('')
  const [encounterId, setEncounterId] = useState('')
  const [speciality, setSpeciality] = useState('Internal Medicine')
  const [summary, setSummary] = useState('')
  const [urgency, setUrgency] = useState('URGENT')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/facility/referral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to_tenant_id: toTenantId.trim(),
          patient_id: patientId.trim(),
          encounter_id: encounterId.trim(),
          speciality,
          clinical_summary: summary,
          urgency,
          consent_obtained: true,
          consent_method: 'screen',
        }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(typeof body.error === 'string' ? body.error : JSON.stringify(body.error))
      router.push(`/referrals/${body.referral.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="clinical-page mx-auto max-w-xl px-4 py-8">
      <Link href="/referrals" className="text-sm text-muted-color">
        ← Referrals
      </Link>
      <h1 className="mt-2 font-display text-2xl text-primary-color">New referral</h1>
      <div className="mt-6 grid gap-3">
        {[
          ['Receiving tenant id', toTenantId, setToTenantId],
          ['Patient id', patientId, setPatientId],
          ['Encounter id', encounterId, setEncounterId],
          ['Speciality', speciality, setSpeciality],
        ].map(([label, value, setter]) => (
          <label key={label as string} className="clinical-card block p-4">
            <span className="text-sm font-medium text-primary-color">{label as string}</span>
            <input
              className="mt-2 w-full rounded-xl border border-subtle bg-base px-3 py-2 text-sm"
              value={value as string}
              onChange={(e) => (setter as (v: string) => void)(e.target.value)}
              disabled={busy}
            />
          </label>
        ))}
        <label className="clinical-card block p-4">
          <span className="text-sm font-medium text-primary-color">Urgency</span>
          <select
            className="mt-2 w-full rounded-xl border border-subtle bg-base px-3 py-2 text-sm"
            value={urgency}
            onChange={(e) => setUrgency(e.target.value)}
            disabled={busy}
          >
            <option value="IMMEDIATE">Immediate</option>
            <option value="URGENT">Urgent</option>
            <option value="ROUTINE">Routine</option>
          </select>
        </label>
        <label className="clinical-card block p-4">
          <span className="text-sm font-medium text-primary-color">Clinical summary</span>
          <textarea
            className="mt-2 w-full rounded-xl border border-subtle bg-base px-3 py-2 text-sm"
            rows={5}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            disabled={busy}
          />
        </label>
      </div>
      {error ? <p className="mt-4 text-sm text-red-500">{error}</p> : null}
      <button
        type="button"
        disabled={busy}
        onClick={() => void submit()}
        className="mt-6 rounded-xl bg-[var(--brand-orange)] px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
      >
        {busy ? 'Sending…' : 'Create referral'}
      </button>
    </main>
  )
}
