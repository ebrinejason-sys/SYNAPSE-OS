'use client'

import { useEffect, useState } from 'react'
import { Building2, Plus, Trash2 } from 'lucide-react'

interface Dept {
  id: string
  name: string
  dept_type: string
}

export default function HospitalAdminDepartmentsPage() {
  const [depts, setDepts] = useState<Dept[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [deptType, setDeptType] = useState('administrative')

  async function load() {
    const res = await fetch('/api/hospital/admin/departments')
    const data = await res.json()
    setDepts(data.departments ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function add() {
    if (!name.trim()) return
    await fetch('/api/hospital/admin/departments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), dept_type: deptType }),
    })
    setName('')
    await load()
  }

  async function remove(id: string) {
    if (!confirm('Remove this department?')) return
    await fetch(`/api/hospital/admin/departments/${id}`, { method: 'DELETE' })
    setDepts((prev) => prev.filter((d) => d.id !== id))
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Departments</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{depts.length} departments</p>
      </div>
      <div className="rounded-2xl p-5 space-y-3" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)' }}>
        <div className="grid grid-cols-2 gap-3">
          <input placeholder="Department name" value={name} onChange={(e) => setName(e.target.value)}
            className="rounded-xl px-4 py-2.5 text-sm outline-none" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-edge)', color: 'var(--text-primary)' }} />
          <select title="Department type" value={deptType} onChange={(e) => setDeptType(e.target.value)}
            className="rounded-xl px-4 py-2.5 text-sm outline-none" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-edge)', color: 'var(--text-primary)' }}>
            {['administrative', 'clinical', 'pharmacy', 'laboratory', 'support'].map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <button type="button" onClick={add} className="btn-primary text-sm flex items-center gap-2"><Plus className="h-4 w-4" /> Add department</button>
      </div>
      {loading ? <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading…</p> : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {depts.map((dept) => (
            <div key={dept.id} className="group flex items-center justify-between rounded-xl p-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)' }}>
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: 'rgba(249,115,22,0.1)', color: 'var(--brand-orange)' }}>
                  <Building2 className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{dept.name}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{dept.dept_type}</p>
                </div>
              </div>
              <button type="button" onClick={() => remove(dept.id)} style={{ color: '#EF4444' }}><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
