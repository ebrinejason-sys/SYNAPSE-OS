'use client'

import { useState } from 'react'

export default function NurseVitalsPage() {
  const [encounterId, setEncounterId] = useState('')
  const [patientId, setPatientId] = useState('')
  const [temperature, setTemperature] = useState('')
  const [heartRate, setHeartRate] = useState('')
  const [bpSys, setBpSys] = useState('')
  const [bpDia, setBpDia] = useState('')
  const [spo2, setSpo2] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setStatus(null)
    try {
      const res = await fetch('/api/nurse/vitals', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          encounter_id: encounterId,
          patient_id: patientId,
          temperature_c: temperature ? Number(temperature) : undefined,
          heart_rate: heartRate ? Number(heartRate) : undefined,
          bp_systolic: bpSys ? Number(bpSys) : undefined,
          bp_diastolic: bpDia ? Number(bpDia) : undefined,
          spo2: spo2 ? Number(spo2) : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Failed to save vitals')
        return
      }
      setStatus(`Vitals saved (${data.vitalsId})`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="min-h-screen bg-base text-primary-color p-8">
      <div className="mx-auto max-w-lg">
        <h1 className="font-display text-2xl">Record Vitals</h1>
        <p className="mt-2 text-sm text-muted-color">Blocked on signed encounters.</p>
        <form onSubmit={submit} className="mt-6 space-y-3">
          <input
            required
            value={encounterId}
            onChange={(e) => setEncounterId(e.target.value)}
            placeholder="Encounter UUID"
            className="w-full rounded-lg border border-slate-700 bg-[#0D1B2E] px-3 py-2 text-sm"
          />
          <input
            required
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
            placeholder="Patient UUID"
            className="w-full rounded-lg border border-slate-700 bg-[#0D1B2E] px-3 py-2 text-sm"
          />
          <div className="grid grid-cols-2 gap-3">
            <input value={temperature} onChange={(e) => setTemperature(e.target.value)} placeholder="Temp °C" className="rounded-lg border border-slate-700 bg-[#0D1B2E] px-3 py-2 text-sm" />
            <input value={heartRate} onChange={(e) => setHeartRate(e.target.value)} placeholder="HR" className="rounded-lg border border-slate-700 bg-[#0D1B2E] px-3 py-2 text-sm" />
            <input value={bpSys} onChange={(e) => setBpSys(e.target.value)} placeholder="BP sys" className="rounded-lg border border-slate-700 bg-[#0D1B2E] px-3 py-2 text-sm" />
            <input value={bpDia} onChange={(e) => setBpDia(e.target.value)} placeholder="BP dia" className="rounded-lg border border-slate-700 bg-[#0D1B2E] px-3 py-2 text-sm" />
            <input value={spo2} onChange={(e) => setSpo2(e.target.value)} placeholder="SpO2" className="rounded-lg border border-slate-700 bg-[#0D1B2E] px-3 py-2 text-sm" />
          </div>
          {error ? <p className="text-sm text-amber-300">{error}</p> : null}
          {status ? <p className="text-sm text-emerald-300">{status}</p> : null}
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl bg-emerald-500 py-3 text-sm font-bold text-black disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save vitals'}
          </button>
        </form>
      </div>
    </main>
  )
}
