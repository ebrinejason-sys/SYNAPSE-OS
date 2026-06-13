'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { Moon, Plus, X } from 'lucide-react'
import { createClient } from '../../../lib/supabase/client'

interface Cycle {
  id: string
  period_start: string
  period_end: string | null
  cycle_start: string
  cycle_end: string | null
  flow_intensity: string | null
  symptoms: string[] | null
  notes: string | null
}

const SYMPTOMS = [
  'Cramps', 'Bloating', 'Headache', 'Fatigue', 'Mood swings',
  'Back pain', 'Nausea', 'Breast tenderness', 'Spotting', 'Heavy flow',
]

const FLOW_OPTIONS = [
  { value: 'spotting', label: 'Spotting', color: '#FCA5A5' },
  { value: 'light', label: 'Light', color: '#F87171' },
  { value: 'medium', label: 'Medium', color: '#EF4444' },
  { value: 'heavy', label: 'Heavy', color: '#B91C1C' },
]

export default function HealthCyclePage() {
  const [cycles, setCycles] = useState<Cycle[]>([])
  const [loading, setLoading] = useState(true)
  const [showLog, setShowLog] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    period_start: new Date().toISOString().split('T')[0],
    period_end: '',
    cycle_start: new Date().toISOString().split('T')[0],
    flow_intensity: 'medium',
    symptoms: [] as string[],
    notes: '',
  })

  useEffect(() => { load() }, [])

  async function load() {
    const supabase = createClient()
    const meRes = await fetch('/api/auth/me')
    const { user } = meRes.ok ? await meRes.json() : { user: null }
    if (!user) { setLoading(false); return }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from('menstrual_cycles')
      .select('id, period_start, period_end, cycle_start, cycle_end, flow_intensity, symptoms, notes')
      .eq('user_id', user.id)
      .order('period_start', { ascending: false })
      .limit(12) as { data: Cycle[] | null }
    setCycles(data ?? [])
    setLoading(false)
  }

  function toggleSymptom(s: string) {
    setForm(prev => ({
      ...prev,
      symptoms: prev.symptoms.includes(s) ? prev.symptoms.filter(x => x !== s) : [...prev.symptoms, s],
    }))
  }

  async function handleSave() {
    setSaving(true)
    const supabase = createClient()
    const meRes = await fetch('/api/auth/me')
    const { user } = meRes.ok ? await meRes.json() : { user: null }
    if (!user) { setSaving(false); return }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('menstrual_cycles').insert({
      user_id: user.id,
      period_start: form.period_start,
      period_end: form.period_end || null,
      cycle_start: form.cycle_start,
      flow_intensity: form.flow_intensity,
      symptoms: form.symptoms.length > 0 ? form.symptoms : null,
      notes: form.notes || null,
    })
    setShowLog(false)
    setSaving(false)
    load()
  }

  const inp = 'w-full rounded-xl px-3 py-2.5 text-sm outline-none'
  const inpStyle = { background: 'var(--bg-elevated)', border: '1px solid var(--border-edge)', color: 'var(--text-primary)' }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Cycle Tracker</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>Track your menstrual health</p>
        </div>
        <button type="button" onClick={() => setShowLog(true)} className="btn-primary flex items-center gap-1.5 text-sm">
          <Plus className="h-4 w-4" /> Log Period
        </button>
      </div>

      {/* Log form */}
      {showLog && (
        <div className="rounded-2xl p-5 space-y-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-orange)' }}>
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Log Period</h3>
            <button type="button" onClick={() => setShowLog(false)} style={{ color: 'var(--text-muted)' }}>
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>Period Start *</label>
              <input type="date" value={form.period_start} onChange={e => setForm(p => ({ ...p, period_start: e.target.value }))} className={inp} style={inpStyle} />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>Period End</label>
              <input type="date" value={form.period_end} onChange={e => setForm(p => ({ ...p, period_end: e.target.value }))} className={inp} style={inpStyle} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>Flow Intensity</label>
            <div className="flex gap-2">
              {FLOW_OPTIONS.map(f => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setForm(p => ({ ...p, flow_intensity: f.value }))}
                  className="flex-1 rounded-xl py-2 text-xs font-semibold transition-all"
                  style={{
                    background: form.flow_intensity === f.value ? `${f.color}22` : 'var(--bg-elevated)',
                    color: form.flow_intensity === f.value ? f.color : 'var(--text-muted)',
                    border: `1px solid ${form.flow_intensity === f.value ? f.color : 'var(--border-edge)'}`,
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>Symptoms</label>
            <div className="flex flex-wrap gap-1.5">
              {SYMPTOMS.map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleSymptom(s)}
                  className="rounded-full px-2.5 py-1 text-xs font-medium transition-all"
                  style={{
                    background: form.symptoms.includes(s) ? 'rgba(249,115,22,0.12)' : 'var(--bg-elevated)',
                    color: form.symptoms.includes(s) ? 'var(--brand-orange)' : 'var(--text-secondary)',
                    border: `1px solid ${form.symptoms.includes(s) ? 'var(--border-orange)' : 'var(--border-edge)'}`,
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>Notes</label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              placeholder="Any notes…"
              className={`${inp} resize-none`}
              style={inpStyle}
            />
          </div>
          <button type="button" onClick={handleSave} disabled={saving} className="btn-primary w-full disabled:opacity-50">
            {saving ? 'Saving…' : 'Save Period Log'}
          </button>
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center" style={{ color: 'var(--text-muted)' }}>Loading cycle history…</div>
      ) : cycles.length === 0 ? (
        <div className="py-12 text-center">
          <Moon className="h-10 w-10 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>No periods logged yet. Start tracking your cycle today.</p>
          <button type="button" onClick={() => setShowLog(true)} className="btn-primary text-sm">Log First Period</button>
        </div>
      ) : (
        <div className="space-y-2">
          {cycles.map(c => (
            <div
              key={c.id}
              className="rounded-2xl p-4"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)' }}
            >
              <div className="flex items-center justify-between mb-2">
                <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                  {new Date(c.period_start).toLocaleDateString('en-UG', { month: 'long', day: 'numeric', year: 'numeric' })}
                  {c.period_end ? ` → ${new Date(c.period_end).toLocaleDateString('en-UG', { month: 'short', day: 'numeric' })}` : ' (ongoing)'}
                </p>
                {c.flow_intensity && (
                  <span className="text-xs capitalize" style={{ color: 'var(--text-muted)' }}>{c.flow_intensity} flow</span>
                )}
              </div>
              {c.symptoms && c.symptoms.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {c.symptoms.map(s => (
                    <span key={s} className="rounded-full px-2 py-0.5 text-[10px]" style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>
                      {s}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
