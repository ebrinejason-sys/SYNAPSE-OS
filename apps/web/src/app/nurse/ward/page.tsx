'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'

type OccupiedBed = {
  bedId: string
  ward: string
  room: string | null
  bedNumber: string
  status: string
  patient: { id: string; fullName: string; mrn?: string }
}

type WardTask = {
  id: string
  patient_id: string | null
  encounter_id: string | null
  task_type: string
  title: string
  status: string
  owner_department: string
  priority: string
}

export default function NurseWardPage() {
  const [occupiedBeds, setOccupiedBeds] = useState<OccupiedBed[]>([])
  const [openTasks, setOpenTasks] = useState<WardTask[]>([])
  const [summary, setSummary] = useState({ total: 0, occupied: 0, available: 0 })
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await fetch('/api/nurse/ward', { credentials: 'include' })
    if (!res.ok) {
      setError('Sign in as nursing staff with ward access to view the bed board.')
      return
    }
    const data = await res.json()
    setOccupiedBeds(data.occupiedBeds ?? [])
    setOpenTasks(data.openTasks ?? [])
    setSummary(data.bedSummary ?? { total: 0, occupied: 0, available: 0 })
    setError(null)
  }, [])

  useEffect(() => {
    load().catch(() => setError('Unable to load ward board'))
  }, [load])

  return (
    <main className="min-h-screen bg-synapse-950 text-white p-8">
      <div className="mx-auto max-w-5xl">
        <h1 className="font-display text-2xl">Ward Board</h1>
        <p className="mt-2 text-sm text-gray-400">
          {summary.occupied}/{summary.total} beds occupied · {summary.available} available
        </p>
        {error ? <p className="mt-4 text-sm text-amber-300">{error}</p> : null}

        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase text-gray-400">Occupied beds</h2>
          <ul className="mt-3 space-y-2">
            {occupiedBeds.map((bed) => (
              <li key={bed.bedId} className="rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="font-medium">
                  {bed.ward} · Bed {bed.bedNumber} {bed.room ? `· ${bed.room}` : ''}
                </p>
                <p className="text-sm text-gray-300">{bed.patient.fullName}</p>
                <p className="text-xs text-gray-500">{bed.patient.mrn ?? bed.patient.id.slice(0, 8)}</p>
              </li>
            ))}
            {occupiedBeds.length === 0 && !error ? (
              <p className="text-sm text-gray-500">No occupied beds.</p>
            ) : null}
          </ul>
        </section>

        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase text-gray-400">Nursing tasks</h2>
          <ul className="mt-3 space-y-2">
            {openTasks.map((task) => (
              <li key={task.id} className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm">
                <p className="font-medium">{task.title}</p>
                <p className="text-xs text-gray-400">
                  {task.task_type} · {task.status} · {task.priority}
                </p>
              </li>
            ))}
            {openTasks.length === 0 && !error ? (
              <p className="text-sm text-gray-500">No open inpatient tasks.</p>
            ) : null}
          </ul>
        </section>

        <Link href="/nurse/vitals" className="mt-8 inline-block text-sm text-emerald-300 underline">
          Record vitals →
        </Link>
      </div>
    </main>
  )
}
