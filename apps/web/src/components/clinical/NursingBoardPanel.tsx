'use client'

import { useCallback, useEffect, useState } from 'react'

type NursingPatient = {
  id: string
  fullName: string
  mrn?: string
  encounterId?: string | null
}

type WardTask = {
  id: string
  patient_id: string | null
  encounter_id: string | null
  task_type: string
  title: string
  status: string
  priority: string
}

type NursingBoardPanelProps = { slug: string }

export function NursingBoardPanel({ slug }: NursingBoardPanelProps) {
  const [patients, setPatients] = useState<NursingPatient[]>([])
  const [tasks, setTasks] = useState<WardTask[]>([])
  const [selectedTask, setSelectedTask] = useState('')
  const [vitals, setVitals] = useState({ encounterId: '', patientId: '', temperature: '', heartRate: '', bpSys: '', bpDia: '', spo2: '' })
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch('/api/nurse/ward', { credentials: 'include' })
    if (!res.ok) throw new Error('Sign in as nursing staff with ward access to view this board.')
    const data = await res.json()
    const occupiedPatients = (data.occupiedBeds ?? []).map((bed: { patient: NursingPatient }) => bed.patient)
    setPatients(occupiedPatients)
    setTasks(data.openTasks ?? [])
    setError(null)
  }, [])

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : 'Unable to load nursing board'))
  }, [load])

  function chooseTask(taskId: string) {
    const task = tasks.find((item) => item.id === taskId)
    setSelectedTask(taskId)
    setVitals((current) => ({
      ...current,
      encounterId: task?.encounter_id ?? current.encounterId,
      patientId: task?.patient_id ?? current.patientId,
    }))
  }

  async function updateTask(nextStatus: string) {
    if (!selectedTask) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/nurse/ward', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ taskId: selectedTask, status: nextStatus }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Unable to update nursing task')
      await load()
      setStatus(`Task ${nextStatus.toLowerCase()}.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update nursing task')
    } finally {
      setSaving(false)
    }
  }

  async function recordVitals(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    setStatus(null)
    try {
      const res = await fetch('/api/nurse/vitals', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          encounter_id: vitals.encounterId,
          patient_id: vitals.patientId,
          temperature_c: vitals.temperature ? Number(vitals.temperature) : undefined,
          heart_rate: vitals.heartRate ? Number(vitals.heartRate) : undefined,
          bp_systolic: vitals.bpSys ? Number(vitals.bpSys) : undefined,
          bp_diastolic: vitals.bpDia ? Number(vitals.bpDia) : undefined,
          spo2: vitals.spo2 ? Number(vitals.spo2) : undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Unable to save vitals')
      setStatus(`Vitals recorded for encounter ${String(data.vitalsId).slice(0, 8)}.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save vitals')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-color">Nursing shift</p>
        <h1 className="mt-2 font-display text-2xl">Ward board</h1>
        <p className="mt-2 text-sm text-muted-color">Review in-scope patients, record vitals, and move nursing tasks forward.</p>
      </div>

      {error ? <p className="text-sm text-amber-700 dark:text-amber-300">{error}</p> : null}
      {status ? <p className="text-sm text-emerald-700 dark:text-emerald-300">{status}</p> : null}

      <section>
        <h2 className="text-sm font-semibold uppercase text-muted-color">Patients in ward</h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {patients.map((patient) => (
            <li key={patient.id} className="clinical-card p-4">
              <p className="font-medium">{patient.fullName}</p>
              <p className="mt-1 text-xs text-muted-color">{patient.mrn ?? patient.id.slice(0, 8)} · {patient.encounterId ? `enc ${patient.encounterId.slice(0, 8)}…` : 'No active encounter'}</p>
              {patient.encounterId ? <button type="button" onClick={() => setVitals((current) => ({ ...current, encounterId: patient.encounterId ?? '', patientId: patient.id }))} className="mt-3 text-xs font-semibold text-primary hover:underline">Record vitals</button> : null}
            </li>
          ))}
          {patients.length === 0 && !error ? <li className="text-sm text-muted-color">No occupied ward beds.</li> : null}
        </ul>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase text-muted-color">Nursing tasks</h2>
        <div className="mt-3 clinical-card p-4">
          <select value={selectedTask} onChange={(event) => chooseTask(event.target.value)} className="w-full rounded-lg border border-subtle bg-surface px-3 py-2 text-sm text-primary-color">
            <option value="">Select a nursing task…</option>
            {tasks.map((task) => <option key={task.id} value={task.id}>{task.title} · {task.status} · {task.priority}</option>)}
          </select>
          {selectedTask ? <div className="mt-3 flex flex-wrap gap-2">
            {tasks.find((task) => task.id === selectedTask)?.status === 'REQUESTED' ? <button type="button" disabled={saving} onClick={() => updateTask('ACCEPTED')} className="rounded-lg border border-edge px-3 py-2 text-xs font-semibold">Accept</button> : null}
            {['ACCEPTED', 'ON_HOLD'].includes(tasks.find((task) => task.id === selectedTask)?.status ?? '') ? <button type="button" disabled={saving} onClick={() => updateTask('IN_PROGRESS')} className="rounded-lg border border-edge px-3 py-2 text-xs font-semibold">Start</button> : null}
            {tasks.find((task) => task.id === selectedTask)?.status === 'IN_PROGRESS' ? <button type="button" disabled={saving} onClick={() => updateTask('COMPLETED')} className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground">Complete</button> : null}
          </div> : null}
          {tasks.length === 0 ? <p className="mt-3 text-xs text-muted-color">No open nursing tasks.</p> : null}
        </div>
      </section>

      <form onSubmit={recordVitals} className="clinical-card max-w-xl p-4">
        <h2 className="text-sm font-semibold uppercase text-muted-color">Record vitals</h2>
        <p className="mt-1 text-xs text-muted-color">The server verifies both encounter and patient tenant scope.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <select required value={vitals.patientId} onChange={(event) => setVitals({ ...vitals, patientId: event.target.value })} className="rounded-lg border border-subtle bg-surface px-3 py-2 text-sm text-primary-color"><option value="">Patient…</option>{patients.map((patient) => <option key={patient.id} value={patient.id}>{patient.fullName}</option>)}</select>
          <input required value={vitals.encounterId} onChange={(event) => setVitals({ ...vitals, encounterId: event.target.value })} placeholder="Encounter UUID" className="rounded-lg border border-subtle bg-surface px-3 py-2 text-sm text-primary-color" />
          {([['temperature', 'Temp °C'], ['heartRate', 'Heart rate'], ['bpSys', 'BP systolic'], ['bpDia', 'BP diastolic'], ['spo2', 'SpO2']] as const).map(([key, label]) => <input key={key} value={vitals[key]} onChange={(event) => setVitals({ ...vitals, [key]: event.target.value })} placeholder={label} className="rounded-lg border border-subtle bg-surface px-3 py-2 text-sm text-primary-color" />)}
        </div>
        <button type="submit" disabled={saving} className="mt-4 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">{saving ? 'Saving…' : 'Save vitals'}</button>
      </form>

      <a href={`/os/${slug}/clinical/queue`} className="text-sm text-primary hover:underline">Open OPD queue →</a>
    </div>
  )
}