'use client'

import { useCallback, useEffect, useState } from 'react'

interface BedRow {
  id: string
  bed_number: string
  ward: string
  bed_type: string
  status: string
  is_occupied: boolean
  active_assignment?: {
    patients?: { full_name?: string; mrn?: string }
  } | null
}

const STATUS_STYLE: Record<string, { background: string; color: string }> = {
  available: { background: 'rgba(34,197,94,0.1)', color: '#22C55E' },
  occupied: { background: 'rgba(239,68,68,0.1)', color: '#EF4444' },
  reserved: { background: 'rgba(234,179,8,0.1)', color: '#EAB308' },
  maintenance: { background: 'rgba(107,114,128,0.1)', color: '#6B7280' },
}

export default function HospitalAdminBedsPage() {
  const [beds, setBeds] = useState<BedRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ bed_number: '', ward: '', bed_type: 'general' })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch('/api/hospital/admin/beds')
    const data = await res.json()
    setBeds(data.beds ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function addBed() {
    if (!form.bed_number.trim() || !form.ward.trim()) return
    setSaving(true)
    const res = await fetch('/api/hospital/admin/beds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaving(false)
    if (res.ok) {
      setForm({ bed_number: '', ward: '', bed_type: 'general' })
      setAdding(false)
      await load()
    }
  }

  const filtered = filter === 'all' ? beds : beds.filter((b) => b.status === filter)
  const occupied = beds.filter((b) => b.is_occupied).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Wards & Beds</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            {occupied} occupied · {beds.length - occupied} free · {beds.length} total
          </p>
        </div>
        <button type="button" onClick={() => setAdding((v) => !v)} className="btn-primary text-sm">+ Add bed</button>
      </div>

      {adding && (
        <div className="rounded-2xl p-5 space-y-3" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)' }}>
          <div className="grid grid-cols-3 gap-3">
            <input placeholder="Bed number" value={form.bed_number} onChange={(e) => setForm((f) => ({ ...f, bed_number: e.target.value }))}
              className="rounded-xl px-3 py-2 text-sm outline-none" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-edge)', color: 'var(--text-primary)' }} />
            <input placeholder="Ward" value={form.ward} onChange={(e) => setForm((f) => ({ ...f, ward: e.target.value }))}
              className="rounded-xl px-3 py-2 text-sm outline-none" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-edge)', color: 'var(--text-primary)' }} />
            <select title="Bed type" value={form.bed_type} onChange={(e) => setForm((f) => ({ ...f, bed_type: e.target.value }))}
              className="rounded-xl px-3 py-2 text-sm outline-none" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-edge)', color: 'var(--text-primary)' }}>
              {['general', 'icu', 'maternity', 'pediatric', 'surgical', 'emergency'].map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <button type="button" onClick={addBed} disabled={saving} className="btn-primary text-sm disabled:opacity-50">
            {saving ? 'Saving…' : 'Save bed'}
          </button>
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {['all', 'available', 'occupied', 'reserved', 'maintenance'].map((s) => (
          <button key={s} type="button" onClick={() => setFilter(s)}
            className="rounded-full px-3 py-1.5 text-xs font-semibold capitalize"
            style={{
              background: filter === s ? 'var(--brand-orange)' : 'var(--bg-elevated)',
              color: filter === s ? '#07070A' : 'var(--text-secondary)',
              border: `1px solid ${filter === s ? 'var(--brand-orange)' : 'var(--border-edge)'}`,
            }}>
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Loading…</div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((bed) => (
            <div key={bed.id} className="rounded-2xl p-4 space-y-2" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)' }}>
              <div className="flex items-center justify-between">
                <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{bed.bed_number}</p>
                <span className="rounded-full px-2 py-0.5 text-[10px] font-bold capitalize" style={STATUS_STYLE[bed.is_occupied ? 'occupied' : bed.status] ?? STATUS_STYLE.maintenance}>
                  {bed.is_occupied ? 'occupied' : bed.status}
                </span>
              </div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{bed.ward} · {bed.bed_type}</p>
              {bed.active_assignment?.patients?.full_name && (
                <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                  {bed.active_assignment.patients.full_name}
                  {bed.active_assignment.patients.mrn ? ` · ${bed.active_assignment.patients.mrn}` : ''}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
