'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useRef, useState } from 'react'
import { Camera, Plus, Utensils, X } from 'lucide-react'
import { createClient } from '../../../lib/supabase/client'

interface DietLog {
  id: string
  logged_at: string
  meal_type: string | null
  food_name: string
  portion_description: string | null
  estimated_calories: number | null
  ai_analysis: { suggestions?: string; nutritional_note?: string } | null
}

const MEAL_TYPES = [
  { value: 'breakfast', label: 'Breakfast', emoji: '🌅' },
  { value: 'lunch', label: 'Lunch', emoji: '☀️' },
  { value: 'dinner', label: 'Dinner', emoji: '🌙' },
  { value: 'snack', label: 'Snack', emoji: '🍎' },
  { value: 'drink', label: 'Drink', emoji: '💧' },
]

export default function HealthDietPage() {
  const [logs, setLogs] = useState<DietLog[]>([])
  const [loading, setLoading] = useState(true)
  const [showLog, setShowLog] = useState(false)
  const [saving, setSaving] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [aiNote, setAiNote] = useState('')
  const photoRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState({
    food_name: '',
    meal_type: 'breakfast',
    portion_description: '',
    estimated_calories: '',
    image_b64: '',
    image_mime: '',
  })

  useEffect(() => { loadLogs() }, [])

  async function loadLogs() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from('diet_logs')
      .select('id, logged_at, meal_type, food_name, portion_description, estimated_calories, ai_analysis')
      .eq('user_id', user.id)
      .order('logged_at', { ascending: false })
      .limit(50) as { data: DietLog[] | null }
    setLogs(data ?? [])
    setLoading(false)
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const b64 = (reader.result as string).split(',')[1] ?? ''
      setForm(p => ({ ...p, image_b64: b64, image_mime: file.type }))
    }
    reader.readAsDataURL(file)
  }

  async function analyzeFood() {
    if (!form.image_b64 && !form.food_name) return
    setAnalyzing(true)
    setAiNote('')
    try {
      const res = await fetch('/api/health/diet-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageB64: form.image_b64, imageMime: form.image_mime, foodName: form.food_name }),
      })
      const data = await res.json() as { calories?: number; note?: string }
      if (data.calories) setForm(p => ({ ...p, estimated_calories: String(data.calories) }))
      if (data.note) setAiNote(data.note)
    } catch { /* silent */ }
    setAnalyzing(false)
  }

  async function handleSave() {
    if (!form.food_name.trim()) return
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('diet_logs').insert({
      user_id: user.id,
      food_name: form.food_name.trim(),
      meal_type: form.meal_type,
      portion_description: form.portion_description || null,
      estimated_calories: form.estimated_calories ? parseInt(form.estimated_calories) : null,
      ai_analysis: aiNote ? { nutritional_note: aiNote } : null,
    })
    setShowLog(false)
    setAiNote('')
    setForm({ food_name: '', meal_type: 'breakfast', portion_description: '', estimated_calories: '', image_b64: '', image_mime: '' })
    setSaving(false)
    loadLogs()
  }

  const todayLogs = logs.filter(l => new Date(l.logged_at).toDateString() === new Date().toDateString())
  const todayCalories = todayLogs.reduce((s, l) => s + (l.estimated_calories ?? 0), 0)

  const inp = 'w-full rounded-xl px-3 py-2.5 text-sm outline-none'
  const inpStyle = { background: 'var(--bg-elevated)', border: '1px solid var(--border-edge)', color: 'var(--text-primary)' }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Diet & Nutrition</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>AI-powered food tracking</p>
        </div>
        <button type="button" onClick={() => setShowLog(true)} className="btn-primary flex items-center gap-1.5 text-sm">
          <Plus className="h-4 w-4" /> Log Food
        </button>
      </div>

      {/* Today summary */}
      <div
        className="rounded-2xl p-4 flex items-center justify-between"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)' }}
      >
        <div>
          <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>TODAY&apos;S CALORIES</p>
          <p className="text-2xl font-bold mt-0.5" style={{ color: 'var(--text-primary)' }}>{todayCalories.toLocaleString()}</p>
        </div>
        <div className="text-right">
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{todayLogs.length} meals logged</p>
        </div>
      </div>

      {/* Log form */}
      {showLog && (
        <div className="rounded-2xl p-5 space-y-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-orange)' }}>
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Log Food</h3>
            <button type="button" onClick={() => setShowLog(false)} style={{ color: 'var(--text-muted)' }}><X className="h-4 w-4" /></button>
          </div>
          {/* Meal type */}
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {MEAL_TYPES.map(m => (
              <button
                key={m.value}
                type="button"
                onClick={() => setForm(p => ({ ...p, meal_type: m.value }))}
                className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 transition-all"
                style={{
                  background: form.meal_type === m.value ? 'var(--brand-orange)' : 'var(--bg-elevated)',
                  color: form.meal_type === m.value ? '#07070A' : 'var(--text-secondary)',
                  border: `1px solid ${form.meal_type === m.value ? 'var(--brand-orange)' : 'var(--border-edge)'}`,
                }}
              >
                {m.emoji} {m.label}
              </button>
            ))}
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>Food Name *</label>
            <input value={form.food_name} onChange={e => setForm(p => ({ ...p, food_name: e.target.value }))} placeholder="e.g. Matooke with groundnut sauce" className={inp} style={inpStyle} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>Portion</label>
              <input value={form.portion_description} onChange={e => setForm(p => ({ ...p, portion_description: e.target.value }))} placeholder="e.g. 1 plate, medium" className={inp} style={inpStyle} />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>Calories (est.)</label>
              <input type="number" value={form.estimated_calories} onChange={e => setForm(p => ({ ...p, estimated_calories: e.target.value }))} placeholder="350" className={inp} style={inpStyle} />
            </div>
          </div>
          {/* Photo upload + AI */}
          <div>
            <input ref={photoRef} type="file" accept="image/*" capture="environment" onChange={handlePhotoUpload} className="hidden" />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => photoRef.current?.click()}
                className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-all"
                style={{
                  background: form.image_b64 ? 'rgba(249,115,22,0.1)' : 'var(--bg-elevated)',
                  color: form.image_b64 ? 'var(--brand-orange)' : 'var(--text-secondary)',
                  border: `1px solid ${form.image_b64 ? 'var(--border-orange)' : 'var(--border-edge)'}`,
                }}
              >
                <Camera className="h-3.5 w-3.5" />
                {form.image_b64 ? 'Photo added' : 'Add photo'}
              </button>
              <button
                type="button"
                onClick={analyzeFood}
                disabled={analyzing || (!form.image_b64 && !form.food_name)}
                className="flex-1 rounded-xl px-3 py-2 text-xs font-semibold transition-all disabled:opacity-50"
                style={{ background: 'rgba(249,115,22,0.1)', color: 'var(--brand-orange)', border: '1px solid var(--border-orange)' }}
              >
                {analyzing ? '⟳ Analysing…' : '✦ AI analyse'}
              </button>
            </div>
          </div>
          {aiNote && (
            <div className="rounded-xl p-3 text-xs" style={{ background: 'rgba(249,115,22,0.06)', color: 'var(--text-secondary)', border: '1px solid var(--border-orange)' }}>
              <span className="font-semibold" style={{ color: 'var(--brand-orange)' }}>AI: </span>{aiNote}
            </div>
          )}
          <button type="button" onClick={handleSave} disabled={saving || !form.food_name.trim()} className="btn-primary w-full disabled:opacity-50">
            {saving ? 'Saving…' : 'Log Meal'}
          </button>
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center" style={{ color: 'var(--text-muted)' }}>Loading diet logs…</div>
      ) : logs.length === 0 ? (
        <div className="py-12 text-center">
          <Utensils className="h-10 w-10 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>No meals logged yet. Track what you eat today.</p>
          <button type="button" onClick={() => setShowLog(true)} className="btn-primary text-sm">Log First Meal</button>
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map(l => {
            const mt = MEAL_TYPES.find(m => m.value === l.meal_type)
            return (
              <div
                key={l.id}
                className="flex items-center gap-3 rounded-xl px-4 py-3"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)' }}
              >
                <span className="text-xl shrink-0">{mt?.emoji ?? '🍽️'}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate" style={{ color: 'var(--text-primary)' }}>{l.food_name}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {mt?.label ?? l.meal_type} · {new Date(l.logged_at).toLocaleDateString('en-UG', { month: 'short', day: 'numeric' })}
                  </p>
                </div>
                {l.estimated_calories && (
                  <span className="text-sm font-bold shrink-0" style={{ color: 'var(--brand-orange)' }}>
                    {l.estimated_calories} kcal
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
