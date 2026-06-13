'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { createClient } from '../../../lib/supabase/client'

interface Bed {
  id: string
  bed_number: string
  ward: string | null
  bed_type: string | null
  status: string
}

const STATUS_STYLE: Record<string, { background: string; color: string }> = {
  available:   { background: 'rgba(34,197,94,0.1)',   color: '#22C55E' },
  occupied:    { background: 'rgba(239,68,68,0.1)',   color: '#EF4444' },
  reserved:    { background: 'rgba(234,179,8,0.1)',   color: '#EAB308' },
  maintenance: { background: 'rgba(107,114,128,0.1)', color: '#6B7280' },
}

export default function AdminBedsPage() {
  const [beds, setBeds] = useState<Bed[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ bed_number: '', ward: '', bed_type: 'general' })
  const [saving, setSaving] = useState(false)

  async function load() {
    const supabase = createClient()
    const meRes = await fetch('/api/auth/me')
    const { user } = meRes.ok ? await meRes.json() : { user: null }
    if (!user) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any
    const { data: profile } = await sb.from('profiles').select('hospital_id').eq('id', user.id).single() as { data: { hospital_id: string } | null }
    if (!profile?.hospital_id) { setLoading(false); return }
    const { data } = await sb.from('beds')
      .select('id, bed_number, ward, bed_type, status')
      .eq('hospital_id', profile.hospital_id)
      .order('ward').order('bed_number') as { data: Bed[] | null }
    setBeds(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function addBed() {
    if (!form.bed_number.trim()) return
    setSaving(true)
    const supabase = createClient()
    const meRes = await fetch('/api/auth/me')
    const { user } = meRes.ok ? await meRes.json() : { user: null }
    if (!user) { setSaving(false); return }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any
    const { data: profile } = await sb.from('profiles').select('hospital_id').eq('id', user.id).single() as { data: { hospital_id: string } | null }
    if (profile?.hospital_id) {
      await sb.from('beds').insert({ ...form, hospital_id: profile.hospital_id, status: 'available' })
      setForm({ bed_number: '', ward: '', bed_type: 'general' })
      setAdding(false)
      await load()
    }
    setSaving(false)
  }

  const filtered = filter === 'all' ? beds : beds.filter(b => b.status === filter)
  const available = beds.filter(b => b.status === 'available').length
  const occupied = beds.filter(b => b.status === 'occupied').length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Bed Management</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            {available} available · {occupied} occupied · {beds.length} total
          </p>
        </div>
        <button type="button" onClick={() => setAdding(v => !v)}
          className="rounded-xl px-4 py-2 text-sm font-semibold"
          style={{ background: 'var(--brand-orange)', color: '#07070A' }}>
          + Add Bed
        </button>
      </div>

      {adding && (
        <div className="rounded-2xl p-5 space-y-3" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)' }}>
          <div className="grid grid-cols-3 gap-3">
            {[
              { key: 'bed_number', placeholder: 'Bed number *' },
              { key: 'ward', placeholder: 'Ward (e.g. Female, ICU)' },
            ].map(f => (
              <input key={f.key} placeholder={f.placeholder}
                value={form[f.key as keyof typeof form]}
                onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                className="rounded-xl px-3 py-2 text-sm outline-none"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-edge)', color: 'var(--text-primary)' }}
              />
            ))}
            <select title="Bed type" value={form.bed_type}
              onChange={e => setForm(f => ({ ...f, bed_type: e.target.value }))}
              className="rounded-xl px-3 py-2 text-sm outline-none"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-edge)', color: 'var(--text-primary)' }}>
              {['general', 'icu', 'maternity', 'pediatric', 'surgical', 'emergency'].map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={addBed} disabled={saving}
              className="rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-60"
              style={{ background: 'var(--brand-orange)', color: '#07070A' }}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button type="button" onClick={() => setAdding(false)}
              className="rounded-xl px-4 py-2 text-sm"
              style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border-edge)' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {['all', 'available', 'occupied', 'reserved', 'maintenance'].map(s => (
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
        <div className="py-16 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Loading beds…</div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map(bed => (
            <div key={bed.id} className="rounded-2xl p-4 space-y-2"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)' }}>
              <div className="flex items-center justify-between">
                <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{bed.bed_number}</p>
                <span className="rounded-full px-2 py-0.5 text-[10px] font-bold capitalize"
                  style={STATUS_STYLE[bed.status] ?? STATUS_STYLE.maintenance}>
                  {bed.status}
                </span>
              </div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {bed.ward ?? 'No ward'} · {bed.bed_type ?? 'general'}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
