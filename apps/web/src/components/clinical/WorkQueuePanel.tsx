'use client'

import { useCallback, useEffect, useState } from 'react'

type DepartmentTask = {
  id: string
  taskType: string
  ownerDepartment: string
  status: string
  priority: string
  patientId: string
  encounterId: string | null
  sourceResource: string | null
  sourceId: string | null
  createdAt: string
  resultSummary?: string | null
}

const DEPARTMENTS = ['', 'opd', 'laboratory', 'pharmacy', 'imaging', 'billing', 'ward'] as const

type WorkQueuePanelProps = {
  initialDepartment?: string
}

export function WorkQueuePanel({ initialDepartment = '' }: WorkQueuePanelProps) {
  const [department, setDepartment] = useState(initialDepartment)
  const [tasks, setTasks] = useState<DepartmentTask[]>([])
  const [error, setError] = useState<string | null>(null)

  const loadTasks = useCallback(async () => {
    const params = new URLSearchParams()
    if (department) params.set('department', department)
    const res = await fetch(`/api/hospital/tasks?${params.toString()}`, { credentials: 'include' })
    if (!res.ok) {
      setError('Sign in as hospital staff to view department tasks.')
      return
    }
    const data = await res.json()
    setTasks(data.tasks ?? [])
    setError(null)
  }, [department])

  useEffect(() => {
    loadTasks().catch(() => setError('Unable to load tasks'))
  }, [loadTasks])

  return (
    <div>
      <h1 className="font-display text-2xl">Department tasks</h1>
      <p className="mt-2 text-sm text-muted-color">
        Unified WorkQueue — lab, pharmacy, triage, and admission handoffs for your facility.
      </p>

      <label className="mt-6 block text-xs text-muted-color">
        Filter by department
        <select
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          className="mt-1 block rounded-lg border border-subtle bg-surface px-3 py-2 text-sm text-primary-color"
        >
          {DEPARTMENTS.map((d) => (
            <option key={d || 'all'} value={d}>
              {d ? d : 'All departments'}
            </option>
          ))}
        </select>
      </label>

      {error ? <p className="mt-4 text-sm text-amber-300">{error}</p> : null}

      <ul className="mt-6 space-y-2">
        {tasks.map((task) => (
          <li key={task.id} className="clinical-card p-3 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium">
                  {task.taskType} · {task.ownerDepartment}
                </p>
                <p className="text-xs text-muted-color">
                  {task.status} · {task.priority}
                  {task.encounterId ? ` · enc ${task.encounterId.slice(0, 8)}…` : ''}
                </p>
                {task.resultSummary ? (
                  <p className="mt-1 text-xs text-secondary-color">{task.resultSummary}</p>
                ) : null}
              </div>
              <span className="text-[10px] uppercase text-muted-color">
                {new Date(task.createdAt).toLocaleString()}
              </span>
            </div>
          </li>
        ))}
        {tasks.length === 0 && !error ? (
          <p className="text-sm text-muted-color">No tasks for this filter.</p>
        ) : null}
      </ul>
    </div>
  )
}
