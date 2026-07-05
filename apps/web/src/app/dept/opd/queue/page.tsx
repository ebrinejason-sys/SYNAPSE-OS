'use client'

import { useCallback, useEffect, useState } from 'react'
import { DepartmentShell } from '../../../../components/hospital-dept/DepartmentShell'
import { PatientSearch } from '../../../../components/hospital-dept/PatientSearch'
import { usePatientContext } from '../../../../hooks/usePatientContext'

interface QueueRow {
  encounterId: string
  patientId: string
  fullName: string
  mrn: string | null
  chiefComplaint: string | null
  clinicalStage: string | null
  status: string
  visitDate: string
}

export default function OpdQueuePage() {
  const { patient, setPatient } = usePatientContext()
  const [queue, setQueue] = useState<QueueRow[]>([])
  const [chiefComplaint, setChiefComplaint] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadQueue = useCallback(async () => {
    const res = await fetch('/api/opd/queue', { credentials: 'include' })
    if (!res.ok) return
    const data = await res.json()
    setQueue(data.queue ?? [])
  }, [])

  useEffect(() => {
    loadQueue()
  }, [loadQueue])

  const submitTriage = useCallback(async () => {
    if (!patient || !chiefComplaint.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/opd/triage', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patient_id: patient.id, chief_complaint: chiefComplaint }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ? JSON.stringify(data.error) : 'Failed to save triage')
        return
      }
      setChiefComplaint('')
      setPatient(null)
      await loadQueue()
    } finally {
      setSubmitting(false)
    }
  }, [patient, chiefComplaint, setPatient, loadQueue])

  return (
    <DepartmentShell
      patientBanner={patient ? <p className="text-sm">Selected: {patient.fullName}</p> : null}
      queuePanel={
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase opacity-70">Today&apos;s Queue</h2>
          <ul className="flex flex-col gap-2">
            {queue.map((row) => (
              <li key={row.encounterId} className="rounded border border-[var(--synapse-border)] p-2 text-sm">
                <p className="font-medium">{row.fullName}</p>
                <p className="opacity-70">{row.chiefComplaint ?? 'No complaint recorded'}</p>
                <p className="text-xs opacity-50">{row.status}</p>
              </li>
            ))}
            {queue.length === 0 && <p className="text-xs opacity-50">No encounters yet today.</p>}
          </ul>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <h1 className="text-lg font-semibold">OPD Triage</h1>
        <PatientSearch onSelect={setPatient} />
        {patient && (
          <div className="flex flex-col gap-2">
            <textarea
              value={chiefComplaint}
              onChange={(e) => setChiefComplaint(e.target.value)}
              placeholder="Chief complaint"
              className="rounded border border-[var(--synapse-border)] bg-transparent p-2 text-sm"
              rows={3}
            />
            {error && <p className="text-xs text-red-400">{error}</p>}
            <button
              type="button"
              disabled={submitting || !chiefComplaint.trim()}
              onClick={submitTriage}
              className="self-start rounded bg-[#F97316] px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
            >
              {submitting ? 'Saving…' : 'Save triage'}
            </button>
          </div>
        )}
      </div>
    </DepartmentShell>
  )
}
