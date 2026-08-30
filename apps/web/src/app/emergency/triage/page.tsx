'use client'

import { useCallback, useEffect, useState } from 'react'
import { PatientSearch } from '../../../components/hospital-dept/PatientSearch'
import type { SelectedPatient } from '../../../hooks/usePatientContext'

type QueueRow = {
  encounterId: string
  patientId: string
  fullName: string
  mrn: string | null
  chiefComplaint: string | null
  clinicalStage: string | null
  status: string
  bayCode: string | null
}

type Bay = {
  id: string
  code: string
  name: string
  locationType: string
  occupied: boolean
}

export default function EmergencyTriagePage() {
  const [patient, setPatient] = useState<SelectedPatient | null>(null)
  const [complaint, setComplaint] = useState('')
  const [stage, setStage] = useState<'RED' | 'YELLOW' | 'GREEN'>('YELLOW')
  const [arrivalMode, setArrivalMode] = useState<'walk_in' | 'ambulance' | 'referral'>('walk_in')
  const [queue, setQueue] = useState<QueueRow[]>([])
  const [bays, setBays] = useState<Bay[]>([])
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [assigningId, setAssigningId] = useState<string | null>(null)

  const loadBoard = useCallback(async () => {
    const [queueRes, baysRes] = await Promise.all([
      fetch('/api/emergency/queue', { credentials: 'include' }),
      fetch('/api/emergency/bays', { credentials: 'include' }),
    ])
    if (queueRes.ok) {
      const data = await queueRes.json()
      setQueue(data.queue ?? [])
    }
    if (baysRes.ok) {
      const data = await baysRes.json()
      setBays(data.bays ?? [])
    }
  }, [])

  useEffect(() => {
    loadBoard().catch(() => setError('Sign in as ED staff to use triage.'))
  }, [loadBoard])

  async function registerQuick() {
    const fullName = window.prompt('Patient full name')
    if (!fullName?.trim()) return
    const sex = window.prompt('Sex (M or F)', 'M')
    if (sex !== 'M' && sex !== 'F') return
    const res = await fetch('/api/patients/register', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name: fullName.trim(), sex }),
    })
    if (!res.ok) {
      setError('Registration failed')
      return
    }
    const data = await res.json()
    setPatient({
      id: data.patient.id,
      fullName: data.patient.full_name,
      mrn: data.patient.mrn,
    })
    setError(null)
  }

  async function submitTriage() {
    if (!patient || !complaint.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/emergency/triage', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: patient.id,
          chief_complaint: complaint.trim(),
          clinical_stage: stage,
          arrival_mode: arrivalMode,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(typeof data.error === 'string' ? data.error : 'Triage failed')
        return
      }
      setComplaint('')
      setPatient(null)
      setError(null)
      await loadBoard()
    } finally {
      setSubmitting(false)
    }
  }

  async function assignBay(row: QueueRow, bayId: string) {
    setAssigningId(row.encounterId)
    try {
      const res = await fetch('/api/emergency/assign-bay', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          encounter_id: row.encounterId,
          patient_id: row.patientId,
          bay_id: bayId,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(typeof data.error === 'string' ? data.error : 'Bay assignment failed')
        return
      }
      await loadBoard()
    } finally {
      setAssigningId(null)
    }
  }

  return (
    <main className="min-h-screen bg-base text-primary-color p-8">
      <div className="mx-auto max-w-5xl">
        <h1 className="font-display text-2xl">Emergency Triage</h1>
        <p className="mt-2 text-sm text-muted-color">
          Rapid registration → triage → bay assignment (production WorkQueue path).
        </p>
        {error ? <p className="mt-4 text-sm text-amber-300">{error}</p> : null}

        <section className="mt-8 rounded-2xl border border-subtle bg-surface p-6">
          <h2 className="text-sm font-semibold uppercase text-muted-color">New arrival</h2>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={registerQuick}
              className="rounded-lg border border-emerald-500/40 px-3 py-2 text-xs text-emerald-300"
            >
              Quick register
            </button>
          </div>
          <div className="mt-4 max-w-md">
            <PatientSearch
              onSelect={(p) => {
                setPatient(p)
                setError(null)
              }}
            />
            {patient ? (
              <p className="mt-2 text-sm text-secondary-color">
                Selected: {patient.fullName} {patient.mrn ? `(${patient.mrn})` : ''}
              </p>
            ) : null}
          </div>
          <textarea
            value={complaint}
            onChange={(e) => setComplaint(e.target.value)}
            placeholder="Chief complaint"
            className="mt-4 w-full rounded-xl border border-subtle bg-black/20 p-3 text-sm"
            rows={3}
          />
          <div className="mt-4 flex flex-wrap gap-3">
            {(['RED', 'YELLOW', 'GREEN'] as const).map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => setStage(level)}
                className={`rounded-lg px-3 py-1 text-xs ${
                  stage === level
                    ? level === 'RED'
                      ? 'bg-red-500/30 text-red-200'
                      : level === 'YELLOW'
                        ? 'bg-amber-500/30 text-amber-200'
                        : 'bg-emerald-500/30 text-emerald-200'
                    : 'border border-subtle text-muted-color'
                }`}
              >
                {level}
              </button>
            ))}
            <select
              value={arrivalMode}
              onChange={(e) => setArrivalMode(e.target.value as typeof arrivalMode)}
              className="rounded-lg border border-subtle bg-transparent px-3 py-1 text-xs"
            >
              <option value="walk_in">Walk-in</option>
              <option value="ambulance">Ambulance</option>
              <option value="referral">Referral</option>
            </select>
          </div>
          <button
            type="button"
            disabled={submitting || !patient || !complaint.trim()}
            onClick={submitTriage}
            className="mt-4 rounded-lg bg-red-600/80 px-4 py-2 text-sm disabled:opacity-50"
          >
            {submitting ? 'Triaging…' : 'Start ED encounter'}
          </button>
        </section>

        <section className="mt-10">
          <h2 className="text-sm font-semibold uppercase text-muted-color">Today&apos;s ED queue</h2>
          <ul className="mt-4 space-y-3">
            {queue.map((row) => (
              <li key={row.encounterId} className="rounded-2xl border border-subtle bg-surface p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {row.fullName}{' '}
                      <span className="text-xs text-muted-color">
                        {row.clinicalStage ?? '—'} · {row.bayCode ?? 'unassigned'}
                      </span>
                    </p>
                    <p className="text-sm text-secondary-color">{row.chiefComplaint}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {bays
                      .filter((b) => !b.occupied)
                      .map((bay) => (
                        <button
                          key={bay.id}
                          type="button"
                          disabled={assigningId === row.encounterId}
                          onClick={() => assignBay(row, bay.id)}
                          className="rounded-lg border border-indigo-500/40 px-2 py-1 text-xs text-indigo-300 disabled:opacity-50"
                        >
                          {bay.code}
                        </button>
                      ))}
                  </div>
                </div>
              </li>
            ))}
            {queue.length === 0 ? (
              <p className="text-sm text-muted-color">No ED encounters today.</p>
            ) : null}
          </ul>
        </section>
      </div>
    </main>
  )
}
