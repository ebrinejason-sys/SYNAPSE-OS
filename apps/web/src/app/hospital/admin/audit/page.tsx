'use client'

import { useCallback, useEffect, useState } from 'react'
import { Shield } from 'lucide-react'

interface AuditLog {
  id: string
  action: string
  table_name: string
  record_id: string | null
  user_id: string | null
  user_role: string | null
  created_at: string
}

interface StaffOption {
  id: string
  full_name: string | null
  email: string | null
}

const inputStyle = {
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-edge)',
  color: 'var(--text-primary)',
}

export default function HospitalAdminAuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [staff, setStaff] = useState<StaffOption[]>([])
  const [loading, setLoading] = useState(true)
  const [action, setAction] = useState('')
  const [userId, setUserId] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({ limit: '150' })
    if (action) params.set('action', action)
    if (userId) params.set('user_id', userId)
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    fetch(`/api/hospital/admin/audit?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => setLogs(d.logs ?? []))
      .finally(() => setLoading(false))
  }, [action, userId, from, to])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    fetch('/api/hospital/admin/staff')
      .then((r) => r.json())
      .then((d) => setStaff(d.staff ?? []))
      .catch(() => {})
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Audit log</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Hospital admin mutations</p>
        </div>
        <Shield className="h-5 w-5" style={{ color: 'var(--brand-orange)' }} />
      </div>
      <div className="flex flex-wrap gap-2">
        <select title="Actor" value={userId} onChange={(e) => setUserId(e.target.value)} className="rounded-xl px-3 py-2 text-sm outline-none" style={inputStyle}>
          <option value="">All staff</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>{s.full_name ?? s.email ?? s.id}</option>
          ))}
        </select>
        <select title="Action" value={action} onChange={(e) => setAction(e.target.value)} className="rounded-xl px-3 py-2 text-sm outline-none" style={inputStyle}>
          <option value="">All actions</option>
          <option value="INSERT">Insert</option>
          <option value="UPDATE">Update</option>
          <option value="DELETE">Delete</option>
        </select>
        <input title="From date" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-xl px-3 py-2 text-sm outline-none" style={inputStyle} />
        <input title="To date" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-xl px-3 py-2 text-sm outline-none" style={inputStyle} />
      </div>
      {loading ? <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading…</p> : logs.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No audit entries yet.</p>
      ) : (
        <div className="space-y-1">
          {logs.map((log) => (
            <div key={log.id} className="flex items-start gap-3 rounded-xl px-4 py-3" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)' }}>
              <Shield className="h-4 w-4 mt-0.5 shrink-0" style={{ color: 'var(--brand-orange)' }} />
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs rounded-full px-2 py-0.5" style={{ background: 'rgba(249,115,22,0.1)', color: '#F97316' }}>{log.action}</span>
                  <span className="text-sm">{log.table_name}</span>
                  {log.user_role && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{log.user_role}</span>}
                </div>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  {log.created_at ? new Date(log.created_at).toLocaleString() : ''}
                  {log.record_id ? ` · ${String(log.record_id).slice(0, 8)}` : ''}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
