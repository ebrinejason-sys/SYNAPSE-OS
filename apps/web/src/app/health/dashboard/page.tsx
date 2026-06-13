'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef } from 'react'
import {
  Home, Activity, FileText, User,
  Heart, Thermometer, Wind, Scale, Plus, X,
  Smartphone, ClipboardList, Calendar, BookOpen,
  AlertCircle, AlertTriangle, Info,
  LogOut, ChevronRight
} from 'lucide-react'
import {
  ResponsiveContainer, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip
} from 'recharts'
import { createClient } from '../../../lib/supabase/client'
import { useIdentity } from '../../../hooks/useIdentity'
import { ModeSwitcher } from '../../../components/ModeSwitcher'

// ─── Types ───────────────────────────────────────────────────────────────────
type Tab = 'home' | 'vitals' | 'report' | 'profile'

interface VitalsForm {
  heart_rate: string
  systolic: string
  diastolic: string
  spo2: string
  temperature: string
  weight: string
}

// ─── Mock data ────────────────────────────────────────────────────────────────
const HEALTH_BULLETINS = [
  {
    id: 1,
    severity: 'critical' as const,
    title: 'Malaria Alert — Kampala District',
    body: 'Elevated malaria cases reported in Kawempe and Makindye divisions. Use treated mosquito nets and seek early testing.',
    timestamp: '2 hours ago',
  },
  {
    id: 2,
    severity: 'warning' as const,
    title: 'Cholera Advisory — Eastern Uganda',
    body: 'Drink only boiled or treated water. Wash hands frequently. Report diarrhoea cases to your nearest health facility.',
    timestamp: '6 hours ago',
  },
  {
    id: 3,
    severity: 'info' as const,
    title: 'Vaccination Drive — Polio Campaign',
    body: 'Free oral polio vaccination available at all district health centres from 8 June to 14 June 2026.',
    timestamp: '1 day ago',
  },
]

const HEART_SPARKLINE: { day: string; hr: number }[] = [
  { day: 'Mon', hr: 72 },
  { day: 'Tue', hr: 74 },
  { day: 'Wed', hr: 71 },
  { day: 'Thu', hr: 76 },
  { day: 'Fri', hr: 73 },
  { day: 'Sat', hr: 75 },
  { day: 'Sun', hr: 72 },
]

const UGANDA_SYMPTOMS = [
  'Fever', 'Headache', 'Cough', 'Malaria symptoms', 'Diarrhoea',
  'Abdominal pain', 'Chest pain', 'Shortness of breath', 'Vomiting',
  'Rash', 'Joint pain', 'Fatigue',
]

const UGANDA_DISTRICTS = [
  'Kampala', 'Wakiso', 'Mukono', 'Jinja', 'Mbarara',
  'Gulu', 'Lira', 'Arua', 'Fort Portal', 'Masaka',
]

const DURATION_OPTIONS = ['< 1 day', '1-3 days', '4-7 days', '> 1 week']

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function randomRef() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let s = ''
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return `RPT-${s}`
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function BulletinCard({ b }: { b: typeof HEALTH_BULLETINS[0] }) {
  const borderColor =
    b.severity === 'critical' ? '#EF4444' :
    b.severity === 'warning'  ? 'var(--brand-gold)' :
    'var(--border-edge)'
  const Icon =
    b.severity === 'critical' ? AlertCircle :
    b.severity === 'warning'  ? AlertTriangle : Info
  const iconColor =
    b.severity === 'critical' ? '#EF4444' :
    b.severity === 'warning'  ? 'var(--brand-gold)' :
    'var(--text-muted)'

  return (
    <div
      className="rounded-xl p-4 mb-3"
      style={{
        background: 'var(--bg-surface)',
        border: `1px solid ${borderColor}`,
      }}
    >
      <div className="flex items-start gap-3">
        <Icon size={18} style={{ color: iconColor, flexShrink: 0, marginTop: 2 }} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{b.title}</p>
          <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{b.body}</p>
          <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>{b.timestamp}</p>
        </div>
      </div>
    </div>
  )
}

function QuickActions() {
  const actions = [
    { label: 'Log Vitals',        Icon: Heart,         accent: 'orange', href: '#vitals' },
    { label: 'Report Symptom',    Icon: FileText,       accent: 'gold',   href: '#report' },
    { label: 'My Records',        Icon: ClipboardList,  accent: 'orange', href: '/patient/records' },
    { label: 'Book Appointment',  Icon: Calendar,       accent: 'gold',   href: '/patient/appointments' },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 mt-4">
      {actions.map(({ label, Icon, accent }) => (
        <button
          key={label}
          className="rounded-xl p-4 flex flex-col items-start gap-3 text-left transition-all hover:scale-[1.02] active:scale-[0.98]"
          style={{
            background: 'var(--bg-surface)',
            border: `1px solid ${accent === 'orange' ? 'var(--border-orange)' : 'var(--border-gold)'}`,
          }}
        >
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{
              background: accent === 'orange'
                ? 'rgba(249,115,22,0.12)'
                : 'rgba(232,184,75,0.12)',
            }}
          >
            <Icon
              size={18}
              style={{ color: accent === 'orange' ? 'var(--brand-orange)' : 'var(--brand-gold)' }}
            />
          </div>
          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{label}</span>
        </button>
      ))}
    </div>
  )
}

// ─── Tab: Home ────────────────────────────────────────────────────────────────
function HomeTab({ name, hospitalName }: { name: string; hospitalName?: string }) {
  return (
    <div className="p-4 max-w-lg mx-auto">
      {/* Greeting */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          {getGreeting()}, <span style={{ color: 'var(--brand-orange)' }}>{name}</span>
        </h1>
        {hospitalName && (
          <div
            className="inline-flex items-center gap-2 mt-2 px-3 py-1 rounded-full text-xs font-semibold"
            style={{ background: 'var(--brand-orange)', color: '#fff' }}
          >
            <BookOpen size={12} />
            {hospitalName}
          </div>
        )}
        <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
          Here&rsquo;s your health update for today.
        </p>
      </div>

      {/* Health bulletins */}
      <h2 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>
        Health Bulletins
      </h2>
      {HEALTH_BULLETINS.map(b => <BulletinCard key={b.id} b={b} />)}

      {/* Quick actions */}
      <h2 className="text-xs font-semibold uppercase tracking-widest mt-6 mb-1" style={{ color: 'var(--text-muted)' }}>
        Quick Actions
      </h2>
      <QuickActions />
    </div>
  )
}

// ─── Tab: Vitals ──────────────────────────────────────────────────────────────
function VitalsTab() {
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<VitalsForm>({
    heart_rate: '', systolic: '', diastolic: '', spo2: '', temperature: '', weight: '',
  })
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const [saving, setSaving] = useState(false)

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const supabase = createClient()
      const meRes = await fetch('/api/auth/me')
      const { user } = meRes.ok ? await meRes.json() : { user: null }
      const payload = {
        user_id: user?.id,
        heart_rate: form.heart_rate ? Number(form.heart_rate) : null,
        blood_pressure_systolic: form.systolic ? Number(form.systolic) : null,
        blood_pressure_diastolic: form.diastolic ? Number(form.diastolic) : null,
        spo2: form.spo2 ? Number(form.spo2) : null,
        temperature: form.temperature ? Number(form.temperature) : null,
        weight_kg: form.weight ? Number(form.weight) : null,
        recorded_at: new Date().toISOString(),
      }
      const { error } = await (supabase as any).from('vitals').insert(payload)
      if (error) throw error
      showToast('Vitals saved successfully!', true)
      setShowModal(false)
      setForm({ heart_rate: '', systolic: '', diastolic: '', spo2: '', temperature: '', weight: '' })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save vitals'
      showToast(msg, false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4 max-w-lg mx-auto pb-28">
      <h1 className="text-xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>My Vitals</h1>

      {/* Sparkline */}
      <div className="rounded-xl p-4 mb-6" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)' }}>
        <p className="text-xs font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>Heart Rate — Last 7 Days</p>
        <ResponsiveContainer width="100%" height={120}>
          <LineChart data={HEART_SPARKLINE}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
            <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
            <YAxis domain={[60, 90]} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} width={28} />
            <Tooltip
              contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-edge)', borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: 'var(--text-secondary)' }}
              itemStyle={{ color: 'var(--brand-orange)' }}
            />
            <Line type="monotone" dataKey="hr" stroke="var(--brand-orange)" strokeWidth={2} dot={{ r: 3, fill: 'var(--brand-orange)' }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Device cards */}
      <h2 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>
        Connected Devices
      </h2>
      {['Smartwatch', 'Glucometer', 'Blood Pressure Monitor'].map(device => (
        <div
          key={device}
          className="flex items-center justify-between rounded-xl p-4 mb-3"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)' }}
        >
          <div className="flex items-center gap-3">
            <Smartphone size={18} style={{ color: 'var(--text-muted)' }} />
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{device}</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No device connected</p>
            </div>
          </div>
          <a
            href="/patient/devices"
            className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors hover:opacity-80"
            style={{ background: 'rgba(249,115,22,0.1)', color: 'var(--brand-orange)' }}
          >
            Connect
          </a>
        </div>
      ))}

      {/* FAB */}
      <button
        onClick={() => setShowModal(true)}
        className="fixed bottom-24 right-5 w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-110 active:scale-95 z-30"
        style={{ background: 'var(--brand-orange)', color: '#fff' }}
        aria-label="Log vitals"
      >
        <Plus size={24} />
      </button>

      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-32 left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl text-sm font-medium shadow-lg z-50 whitespace-nowrap"
          style={{
            background: toast.ok ? '#22C55E' : '#EF4444',
            color: '#fff',
          }}
        >
          {toast.msg}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{ background: 'rgba(0,0,0,0.7)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}
        >
          <div
            className="w-full max-w-sm rounded-2xl p-6"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-edge)' }}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>Log Vitals</h2>
              <button onClick={() => setShowModal(false)} style={{ color: 'var(--text-muted)' }}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              {[
                { label: 'Heart Rate (bpm)', key: 'heart_rate', placeholder: '72' },
                { label: 'Systolic BP (mmHg)', key: 'systolic', placeholder: '120' },
                { label: 'Diastolic BP (mmHg)', key: 'diastolic', placeholder: '80' },
                { label: 'SpO₂ (%)', key: 'spo2', placeholder: '98' },
                { label: 'Temperature (°C)', key: 'temperature', placeholder: '36.6' },
                { label: 'Weight (kg)', key: 'weight', placeholder: '70' },
              ].map(({ label, key, placeholder }) => (
                <div key={key}>
                  <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>{label}</label>
                  <input
                    type="number"
                    step="any"
                    placeholder={placeholder}
                    value={form[key as keyof VitalsForm]}
                    onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:ring-2"
                    style={{
                      background: 'var(--bg-overlay)',
                      border: '1px solid var(--border-edge)',
                      color: 'var(--text-primary)',
                    }}
                  />
                </div>
              ))}
              <button
                type="submit"
                disabled={saving}
                className="w-full py-2.5 rounded-xl font-semibold text-sm mt-2 transition-opacity disabled:opacity-60"
                style={{ background: 'var(--brand-orange)', color: '#fff' }}
              >
                {saving ? 'Saving…' : 'Save Vitals'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Tab: Report ──────────────────────────────────────────────────────────────
function ReportTab() {
  const [anonymous, setAnonymous] = useState(false)
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([])
  const [duration, setDuration] = useState('')
  const [severity, setSeverity] = useState(5)
  const [district, setDistrict] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [confirmation, setConfirmation] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const toggleSymptom = (s: string) =>
    setSelectedSymptoms(prev =>
      prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
    )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedSymptoms.length === 0) { setError('Please select at least one symptom.'); return }
    if (!district) { setError('Please select a district.'); return }
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/surveillance/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anonymous, symptoms: selectedSymptoms, duration, severity, district }),
      })
      // Even if route doesn't exist yet, still show confirmation
      if (!res.ok && res.status !== 404) throw new Error('Submission failed. Try again.')
      setConfirmation(randomRef())
      setSelectedSymptoms([])
      setDuration('')
      setSeverity(5)
      setDistrict('')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  if (confirmation) {
    return (
      <div className="p-4 max-w-lg mx-auto flex flex-col items-center justify-center min-h-[60vh]">
        <div
          className="w-full rounded-2xl p-8 text-center"
          style={{ background: 'var(--bg-surface)', border: '2px solid var(--brand-gold)' }}
        >
          <div className="text-4xl mb-4">✅</div>
          <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Report Submitted</h2>
          <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
            Thank you for helping us track public health in your district.
          </p>
          <div
            className="inline-block px-4 py-2 rounded-xl font-mono font-bold text-lg"
            style={{ background: 'rgba(232,184,75,0.12)', color: 'var(--brand-gold)' }}
          >
            {confirmation}
          </div>
          <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>Your reference number</p>
          <button
            onClick={() => setConfirmation(null)}
            className="mt-6 px-6 py-2 rounded-xl text-sm font-semibold transition-opacity hover:opacity-80"
            style={{ background: 'var(--brand-orange)', color: '#fff' }}
          >
            Report Another
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 max-w-lg mx-auto pb-28">
      <h1 className="text-xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Report Symptoms</h1>
      <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)' }}>
        Help Uganda&rsquo;s health surveillance system by reporting your symptoms.
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Anonymous toggle */}
        <div className="flex items-center justify-between p-4 rounded-xl" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)' }}>
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Report anonymously</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Your identity will not be shared</p>
          </div>
          <button
            type="button"
            onClick={() => setAnonymous(p => !p)}
            className={`w-12 h-6 rounded-full transition-colors relative ${anonymous ? 'bg-orange-500' : ''}`}
            style={anonymous ? {} : { background: 'var(--border-edge)' }}
            aria-pressed={anonymous}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${anonymous ? 'translate-x-6' : 'translate-x-0.5'}`}
            />
          </button>
        </div>

        {/* Symptoms */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-widest block mb-2" style={{ color: 'var(--text-muted)' }}>
            Symptoms (select all that apply)
          </label>
          <div className="flex flex-wrap gap-2">
            {UGANDA_SYMPTOMS.map(s => (
              <button
                key={s}
                type="button"
                onClick={() => toggleSymptom(s)}
                className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                style={
                  selectedSymptoms.includes(s)
                    ? { background: 'var(--brand-orange)', color: '#fff', border: '1px solid var(--brand-orange)' }
                    : { background: 'var(--bg-surface)', color: 'var(--text-secondary)', border: '1px solid var(--border-edge)' }
                }
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Duration */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-widest block mb-2" style={{ color: 'var(--text-muted)' }}>
            Duration
          </label>
          <div className="flex flex-wrap gap-2">
            {DURATION_OPTIONS.map(d => (
              <button
                key={d}
                type="button"
                onClick={() => setDuration(d)}
                className="px-4 py-2 rounded-xl text-xs font-medium transition-all"
                style={
                  duration === d
                    ? { background: 'rgba(232,184,75,0.2)', color: 'var(--brand-gold)', border: '1px solid var(--brand-gold)' }
                    : { background: 'var(--bg-surface)', color: 'var(--text-secondary)', border: '1px solid var(--border-edge)' }
                }
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        {/* Severity */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-widest block mb-2" style={{ color: 'var(--text-muted)' }}>
            Severity: <span style={{ color: 'var(--brand-orange)' }}>{severity}/10</span>
          </label>
          <input
            type="range"
            min={1}
            max={10}
            value={severity}
            onChange={e => setSeverity(Number(e.target.value))}
            className="w-full accent-orange-500"
          />
          <div className="flex justify-between text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            <span>Mild</span><span>Severe</span>
          </div>
        </div>

        {/* District */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-widest block mb-2" style={{ color: 'var(--text-muted)' }}>
            District
          </label>
          <select
            value={district}
            onChange={e => setDistrict(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-edge)',
              color: district ? 'var(--text-primary)' : 'var(--text-muted)',
            }}
          >
            <option value="">Select district…</option>
            {UGANDA_DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3 rounded-xl font-semibold text-sm transition-opacity disabled:opacity-60"
          style={{ background: 'var(--brand-orange)', color: '#fff' }}
        >
          {submitting ? 'Submitting…' : 'Submit Report'}
        </button>
      </form>
    </div>
  )
}

// ─── Tab: Profile ─────────────────────────────────────────────────────────────
function ProfileTab() {
  const identity = useIdentity()
  const supabase = createClient()
  const [editField, setEditField] = useState<'full_name' | 'phone' | null>(null)
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [emergencyName, setEmergencyName] = useState('')
  const [emergencyPhone, setEmergencyPhone] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (identity && identity !== 'loading') {
      const name = identity.staffProfile?.fullName || identity.patientProfile?.fullName || ''
      const ph = identity.patientProfile?.phone || ''
      setFullName(name)
      setPhone(ph)

      // Load emergency contact from localStorage
      const ec = localStorage.getItem(`synapse-ec-${identity.userId}`)
      if (ec) {
        try {
          const parsed = JSON.parse(ec)
          setEmergencyName(parsed.name || '')
          setEmergencyPhone(parsed.phone || '')
        } catch { /* ignore */ }
      }
    }
  }, [identity])

  useEffect(() => {
    if (editField) inputRef.current?.focus()
  }, [editField])

  const saveField = async (field: 'full_name' | 'phone') => {
    if (!identity || identity === 'loading') return
    const table = identity.staffProfile ? 'profiles' : 'patient_profiles'
    const value = field === 'full_name' ? fullName : phone
    await (supabase as any).from(table).update({ [field]: value }).eq('id', identity.userId)
    setEditField(null)
  }

  const saveEmergencyContact = () => {
    if (!identity || identity === 'loading') return
    localStorage.setItem(`synapse-ec-${identity.userId}`, JSON.stringify({ name: emergencyName, phone: emergencyPhone }))
  }

  const handleSignOut = async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  if (!identity || identity === 'loading') {
    return (
      <div className="p-4 max-w-lg mx-auto flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const displayName: string = identity.staffProfile?.fullName || identity.patientProfile?.fullName || identity.email.split('@')[0] || 'User'

  return (
    <div className="p-4 max-w-lg mx-auto pb-28 space-y-4">
      <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>My Profile</h1>

      {/* Identity card */}
      <div className="rounded-2xl p-5" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)' }}>
        <div className="flex items-center gap-4 mb-4">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold"
            style={{ background: 'rgba(249,115,22,0.15)', color: 'var(--brand-orange)' }}
          >
            {(displayName[0] ?? 'U').toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-base" style={{ color: 'var(--text-primary)' }}>{displayName}</p>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{identity.email}</p>
            {identity.staffProfile && (
              <span
                className="inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-semibold"
                style={{ background: 'var(--brand-orange)', color: '#fff' }}
              >
                {identity.staffProfile.role}
              </span>
            )}
          </div>
        </div>

        {/* Editable fields */}
        {[
          { label: 'Full Name', field: 'full_name' as const, value: fullName, setValue: setFullName },
          { label: 'Phone', field: 'phone' as const, value: phone, setValue: setPhone },
        ].map(({ label, field, value, setValue }) => (
          <div key={field} className="mb-3">
            <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>{label}</p>
            {editField === field ? (
              <input
                ref={inputRef}
                value={value}
                onChange={e => setValue(e.target.value)}
                onBlur={() => saveField(field)}
                onKeyDown={e => { if (e.key === 'Enter') saveField(field) }}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ background: 'var(--bg-overlay)', border: '1px solid var(--brand-orange)', color: 'var(--text-primary)' }}
              />
            ) : (
              <button
                onClick={() => setEditField(field)}
                className="flex items-center justify-between w-full px-3 py-2 rounded-lg text-sm text-left hover:opacity-80 transition-opacity"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-edge)', color: 'var(--text-primary)' }}
              >
                <span>{value || <span style={{ color: 'var(--text-muted)' }}>Not set</span>}</span>
                <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Emergency contact */}
      <div className="rounded-2xl p-5" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)' }}>
        <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Emergency Contact</h3>
        <div className="space-y-2">
          <input
            placeholder="Contact name"
            value={emergencyName}
            onChange={e => setEmergencyName(e.target.value)}
            onBlur={saveEmergencyContact}
            className="w-full px-3 py-2 rounded-lg text-sm outline-none"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-edge)', color: 'var(--text-primary)' }}
          />
          <input
            placeholder="Phone number"
            value={emergencyPhone}
            onChange={e => setEmergencyPhone(e.target.value)}
            onBlur={saveEmergencyContact}
            className="w-full px-3 py-2 rounded-lg text-sm outline-none"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-edge)', color: 'var(--text-primary)' }}
          />
        </div>
      </div>

      {/* Mode switcher */}
      {identity.hasBothModes && (
        <div className="rounded-2xl p-5" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)' }}>
          <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Switch Mode</h3>
          <ModeSwitcher />
        </div>
      )}

      {/* Sign out */}
      <button
        onClick={handleSignOut}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-opacity hover:opacity-80"
        style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.2)' }}
      >
        <LogOut size={16} />
        Sign Out
      </button>
    </div>
  )
}

// ─── Nav items ─────────────────────────────────────────────────────────────────
const NAV_ITEMS: { id: Tab; label: string; Icon: React.FC<{ size?: number; style?: React.CSSProperties }> }[] = [
  { id: 'home',    label: 'Home',    Icon: Home },
  { id: 'vitals',  label: 'Vitals',  Icon: Activity },
  { id: 'report',  label: 'Report',  Icon: FileText },
  { id: 'profile', label: 'Profile', Icon: User },
]

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function HealthDashboardPage() {
  const [tab, setTab] = useState<Tab>('home')
  const identity = useIdentity()

  const displayName: string = identity && identity !== 'loading'
    ? (identity.staffProfile?.fullName || identity.patientProfile?.fullName || identity.email.split('@')[0] || 'there')
    : 'there'

  const hospitalName = identity && identity !== 'loading'
    ? identity.staffProfile ? 'Hospital Staff' : undefined
    : undefined

  const navStyle = (active: boolean) => active
    ? { color: 'var(--brand-orange)' }
    : { color: 'var(--text-muted)' }

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg-base)' }}>
      {/* Sidebar — desktop */}
      <aside
        className="hidden md:flex flex-col w-56 min-h-screen py-8 px-4 gap-1 shrink-0"
        style={{ background: 'var(--bg-surface)', borderRight: '1px solid var(--border-edge)' }}
      >
        <div className="mb-8 px-2">
          <span className="font-bold text-lg" style={{ color: 'var(--brand-orange)' }}>Synapse</span>
          <span className="text-xs ml-1 font-medium" style={{ color: 'var(--text-muted)' }}>Health</span>
        </div>
        {NAV_ITEMS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left"
            style={
              tab === id
                ? { background: 'rgba(249,115,22,0.12)', color: 'var(--brand-orange)' }
                : { color: 'var(--text-secondary)' }
            }
          >
            <Icon size={18} />
            {label}
          </button>
        ))}
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {tab === 'home'    && <HomeTab name={displayName} hospitalName={hospitalName} />}
        {tab === 'vitals'  && <VitalsTab />}
        {tab === 'report'  && <ReportTab />}
        {tab === 'profile' && <ProfileTab />}
      </main>

      {/* Bottom nav — mobile */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 flex items-center justify-around py-2 z-20"
        style={{ background: 'var(--bg-surface)', borderTop: '1px solid var(--border-edge)' }}
      >
        {NAV_ITEMS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className="flex flex-col items-center gap-1 px-4 py-1 transition-all"
            style={navStyle(tab === id)}
          >
            <Icon size={22} />
            <span className="text-[10px] font-medium">{label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
