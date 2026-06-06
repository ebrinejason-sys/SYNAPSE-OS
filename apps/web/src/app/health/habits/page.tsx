'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { Activity, CheckCircle, Circle, Flame, Plus, X } from 'lucide-react'
import { createClient } from '../../../lib/supabase/client'

interface Habit {
  id: string
  name: string
  category: string
  frequency: string
  target_value: number | null
  target_unit: string | null
  streak_days: number
  last_logged_at: string | null
  is_active: boolean
}

const CATEGORIES = [
  { value: 'exercise', label: 'Exercise', emoji: '🏃' },
  { value: 'sleep', label: 'Sleep', emoji: '😴' },
  { value: 'hydration', label: 'Hydration', emoji: '💧' },
  { value: 'meditation', label: 'Meditation', emoji: '🧘' },
  { value: 'medication', label: 'Medication', emoji: '💊' },
  { value: 'custom', label: 'Custom', emoji: '⭐' },
]

export default function HealthHabitsPage() {
  const [habits, setHabits] = useState<Habit[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loggingId, setLoggingId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', category: 'exercise', target_value: '', target_unit: '' })

  useEffect(() => { loadHabits() }, [])

  async function loadHabits() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from('health_habits')
      .select('id, name, category, frequency, target_value, target_unit, streak_days, last_logged_at, is_active')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false }) as { data: Habit[] | null }
    setHabits(data ?? [])
    setLoading(false)
  }

  async function handleAdd() {
    if (!form.name.trim()) return
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('health_habits').insert({
      user_id: user.id,
      name: form.name.trim(),
      category: form.category,
      frequency: 'daily',
      target_value: form.target_value ? parseFloat(form.target_value) : null,
      target_unit: form.target_unit || null,
    })
    setShowAdd(false)
    setForm({ name: '', category: 'exercise', target_value: '', target_unit: '' })
    setSaving(false)
    loadHabits()
  }

  async function logHabit(habit: Habit) {
    setLoggingId(habit.id)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoggingId(null); return }
    const today = new Date().toISOString().split('T')[0] ?? ''
    const alreadyLoggedToday = habit.last_logged_at?.startsWith(today)
    if (alreadyLoggedToday) { setLoggingId(null); return }

    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0] ?? ''
    const newStreak = habit.last_logged_at?.startsWith(yesterday) ? habit.streak_days + 1 : 1

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await Promise.all([
      (supabase as any).from('habit_logs').insert({ habit_id: habit.id, user_id: user.id }),
      (supabase as any).from('health_habits').update({ last_logged_at: new Date().toISOString(), streak_days: newStreak }).eq('id', habit.id),
    ])
    setLoggingId(null)
    loadHabits()
  }

  const inp = 'w-full rounded-xl px-3 py-2.5 text-sm outline-none'
  const inpStyle = { background: 'var(--bg-elevated)', border: '1px solid var(--border-edge)', color: 'var(--text-primary)' }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Habit Tracker</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>Build healthy daily habits</p>
        </div>
        <button type="button" onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-1.5 text-sm">
          <Plus className="h-4 w-4" /> Add Habit
        </button>
      </div>

      {/* Add habit form */}
      {showAdd && (
        <div className="rounded-2xl p-5 space-y-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-orange)' }}>
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>New Habit</h3>
            <button type="button" onClick={() => setShowAdd(false)} style={{ color: 'var(--text-muted)' }}><X className="h-4 w-4" /></button>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>Habit Name *</label>
            <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Walk 30 minutes" className={inp} style={inpStyle} />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>Category</label>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORIES.map(c => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setForm(p => ({ ...p, category: c.value }))}
                  className="flex items-center gap-1.5 rounded-xl px-2 py-2 text-xs font-medium transition-all"
                  style={{
                    background: form.category === c.value ? 'rgba(249,115,22,0.1)' : 'var(--bg-elevated)',
                    color: form.category === c.value ? 'var(--brand-orange)' : 'var(--text-secondary)',
                    border: `1px solid ${form.category === c.value ? 'var(--border-orange)' : 'var(--border-edge)'}`,
                  }}
                >
                  {c.emoji} {c.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>Target (optional)</label>
              <input type="number" value={form.target_value} onChange={e => setForm(p => ({ ...p, target_value: e.target.value }))} placeholder="30" className={inp} style={inpStyle} />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>Unit</label>
              <input value={form.target_unit} onChange={e => setForm(p => ({ ...p, target_unit: e.target.value }))} placeholder="minutes" className={inp} style={inpStyle} />
            </div>
          </div>
          <button type="button" onClick={handleAdd} disabled={saving || !form.name.trim()} className="btn-primary w-full disabled:opacity-50">
            {saving ? 'Adding…' : 'Add Habit'}
          </button>
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center" style={{ color: 'var(--text-muted)' }}>Loading habits…</div>
      ) : habits.length === 0 ? (
        <div className="py-12 text-center">
          <Activity className="h-10 w-10 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>No habits yet. Add your first daily habit to start your streak.</p>
          <button type="button" onClick={() => setShowAdd(true)} className="btn-primary text-sm">Add First Habit</button>
        </div>
      ) : (
        <div className="space-y-2">
          {habits.map(h => {
            const cat = CATEGORIES.find(c => c.value === h.category)
            const today = new Date().toISOString().split('T')[0] ?? ''
            const doneToday = h.last_logged_at?.startsWith(today) ?? false
            return (
              <div
                key={h.id}
                className="flex items-center gap-4 rounded-2xl p-4 transition-all"
                style={{
                  background: doneToday ? 'rgba(34,197,94,0.05)' : 'var(--bg-surface)',
                  border: `1px solid ${doneToday ? 'rgba(34,197,94,0.2)' : 'var(--border-edge)'}`,
                }}
              >
                <button
                  type="button"
                  onClick={() => !doneToday && logHabit(h)}
                  disabled={loggingId === h.id || doneToday}
                  className="shrink-0 transition-all"
                  style={{ color: doneToday ? '#22C55E' : 'var(--text-muted)' }}
                >
                  {doneToday ? <CheckCircle className="h-6 w-6" /> : <Circle className="h-6 w-6" />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span>{cat?.emoji}</span>
                    <p className="font-medium text-sm" style={{ color: doneToday ? '#22C55E' : 'var(--text-primary)' }}>
                      {h.name}
                    </p>
                  </div>
                  {h.target_value && (
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      Target: {h.target_value} {h.target_unit}
                    </p>
                  )}
                </div>
                {h.streak_days > 0 && (
                  <div className="flex items-center gap-1 shrink-0">
                    <Flame className="h-4 w-4" style={{ color: '#F97316' }} />
                    <span className="text-sm font-bold" style={{ color: '#F97316' }}>{h.streak_days}</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
