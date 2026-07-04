'use client'

import { useEffect, useState } from 'react'
import { BedDouble, Plus } from 'lucide-react'

interface Ward {
  id: string
  name: string
  capacity: number
  beds_total: number
  beds_occupied: number
}

interface Bed {
  id: string
  bed_number: string
  ward: string
  bed_type: string
  status: string
  is_occupied: boolean
}

export default function HospitalAdminWardsPage() {
  const [wards, setWards] = useState<Ward[]>([])
  const [beds, setBeds] = useState<Bed[]>([])
  const [wardName, setWardName] = useState('')
  const [wardCapacity, setWardCapacity] = useState('10')
  const [bedForm, setBedForm] = useState({ bed_number: '', ward: '', bed_type: 'general' })
  const [loading, setLoading] = useState(true)

  async function load() {
    const [wRes, bRes] = await Promise.all([
      fetch('/api/hospital/admin/wards'),
      fetch('/api/hospital/admin/beds'),
    ])
    const wData = await wRes.json()
    const bData = await bRes.json()
    setWards(wData.wards ?? [])
    setBeds(bData.beds ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const effectiveStatus = (b: Bed) => (b.is_occupied ? 'occupied' : b.status)
  const occupied = beds.filter((b) => effectiveStatus(b) === 'occupied').length
  const available = beds.filter((b) => effectiveStatus(b) === 'available').length

  async function addWard() {
    if (!wardName.trim()) return
    await fetch('/api/hospital/admin/wards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: wardName.trim(), capacity: Number(wardCapacity) || 0 }),
    })
    setWardName('')
    await load()
  }

  async function addBed() {
    if (!bedForm.bed_number.trim() || !bedForm.ward.trim()) return
    await fetch('/api/hospital/admin/beds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bedForm),
    })
    setBedForm({ bed_number: '', ward: '', bed_type: 'general' })
    await load()
  }

  const STATUS_COLOR: Record<string, string> = {
    available: '#22C55E', occupied: '#EF4444', reserved: '#EAB308', maintenance: '#6B7280',
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Wards & beds</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          {available} available · {occupied} occupied · {beds.length} total beds
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl p-5 space-y-3" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)' }}>
          <h2 className="text-sm font-semibold">Add ward</h2>
          <div className="grid grid-cols-2 gap-2">
            <input placeholder="Ward name" value={wardName} onChange={(e) => setWardName(e.target.value)} className="rounded-xl px-3 py-2 text-sm outline-none" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-edge)', color: 'var(--text-primary)' }} />
            <input placeholder="Capacity" type="number" value={wardCapacity} onChange={(e) => setWardCapacity(e.target.value)} className="rounded-xl px-3 py-2 text-sm outline-none" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-edge)', color: 'var(--text-primary)' }} />
          </div>
          <button type="button" onClick={addWard} className="btn-primary text-sm flex items-center gap-2"><Plus className="h-4 w-4" /> Add ward</button>
        </div>
        <div className="rounded-2xl p-5 space-y-3" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)' }}>
          <h2 className="text-sm font-semibold">Add bed</h2>
          <div className="grid grid-cols-3 gap-2">
            <input placeholder="Bed #" value={bedForm.bed_number} onChange={(e) => setBedForm((f) => ({ ...f, bed_number: e.target.value }))} className="rounded-xl px-3 py-2 text-sm outline-none" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-edge)', color: 'var(--text-primary)' }} />
            <input placeholder="Ward" value={bedForm.ward} onChange={(e) => setBedForm((f) => ({ ...f, ward: e.target.value }))} className="rounded-xl px-3 py-2 text-sm outline-none" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-edge)', color: 'var(--text-primary)' }} />
            <select title="Bed type" value={bedForm.bed_type} onChange={(e) => setBedForm((f) => ({ ...f, bed_type: e.target.value }))} className="rounded-xl px-3 py-2 text-sm outline-none" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-edge)', color: 'var(--text-primary)' }}>
              {['general', 'icu', 'maternity', 'pediatric', 'surgical', 'emergency'].map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <button type="button" onClick={addBed} className="btn-primary text-sm flex items-center gap-2"><Plus className="h-4 w-4" /> Add bed</button>
        </div>
      </div>
      {loading ? <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading…</p> : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {wards.map((w) => (
              <div key={w.id} className="rounded-xl p-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)' }}>
                <p className="font-semibold text-sm">{w.name}</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Capacity {w.capacity} · {w.beds_occupied}/{w.beds_total} occupied</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {beds.map((bed) => (
              <div key={bed.id} className="rounded-xl p-3" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)' }}>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm flex items-center gap-1"><BedDouble className="h-3.5 w-3.5" /> {bed.bed_number}</span>
                  <span className="text-[10px] font-bold capitalize" style={{ color: STATUS_COLOR[effectiveStatus(bed)] ?? '#6B7280' }}>{effectiveStatus(bed)}</span>
                </div>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{bed.ward} · {bed.bed_type}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
