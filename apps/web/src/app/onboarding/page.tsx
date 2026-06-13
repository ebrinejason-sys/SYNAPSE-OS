'use client'
export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { Stethoscope, User, ArrowLeft, CheckCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'
import { getCurrentUser } from '@/lib/auth/getCurrentUser'

// ─── Types ────────────────────────────────────────────────────────────────────
type Path = 'staff' | 'patient' | null

interface PatientForm {
  full_name: string
  phone: string
  date_of_birth: string
  sex: string
  hospital_name: string
}

// ─── Uganda hospitals ─────────────────────────────────────────────────────────
const UGANDA_HOSPITALS = [
  'Mulago National Referral Hospital',
  'Mengo Hospital',
  'Kiruddu General Hospital',
  'Entebbe Grade B Hospital',
  'Jinja Regional Referral Hospital',
  'Mbarara Regional Referral Hospital',
  'Gulu Regional Referral Hospital',
  'Lira Regional Referral Hospital',
  'Arua Regional Referral Hospital',
  'Fort Portal Regional Referral Hospital',
  'Masaka Regional Referral Hospital',
  'Kabale Regional Referral Hospital',
  'Soroti Regional Referral Hospital',
  'Moroto Regional Referral Hospital',
  'Uganda Martyrs Hospital Lubaga',
  'International Hospital Kampala (IHK)',
  'Aga Khan Hospital Kampala',
  'Case Hospital',
  'Nakasero Hospital',
  'St. Francis Hospital Nsambya',
]

// ─── Step indicator ───────────────────────────────────────────────────────────
function StepIndicator({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className="h-1.5 rounded-full flex-1 transition-all"
          style={
            i < step
              ? { background: 'var(--brand-orange)' }
              : { background: 'var(--border-edge)' }
          }
        />
      ))}
      <span className="text-xs ml-2 whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
        Step {step} of {total}
      </span>
    </div>
  )
}

// ─── Step 1 — Choose path ─────────────────────────────────────────────────────
function ChoosePath({ onSelect }: { onSelect: (p: Path) => void }) {
  const [hovered, setHovered] = useState<Path>(null)

  const cards = [
    {
      id: 'staff' as const,
      title: 'Hospital Staff',
      subtitle: 'I have an invite code from my hospital',
      Icon: Stethoscope,
      borderColor: 'var(--brand-orange)',
      iconBg: 'rgba(249,115,22,0.12)',
      iconColor: 'var(--brand-orange)',
    },
    {
      id: 'patient' as const,
      title: 'Patient / Personal',
      subtitle: 'I\'m registering as a patient or personal health user',
      Icon: User,
      borderColor: 'var(--brand-gold)',
      iconBg: 'rgba(232,184,75,0.12)',
      iconColor: 'var(--brand-gold)',
    },
  ]

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 py-12" style={{ background: 'var(--bg-base)' }}>
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-10">
          <span className="font-bold text-3xl" style={{ color: 'var(--brand-orange)' }}>Synapse</span>
          <span className="text-3xl font-light ml-1" style={{ color: 'var(--text-primary)' }}>OS</span>
          <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>Let&rsquo;s set up your account</p>
        </div>

        <StepIndicator step={1} total={2} />

        <h1 className="text-xl font-bold mb-2 text-center" style={{ color: 'var(--text-primary)' }}>Who are you?</h1>
        <p className="text-sm text-center mb-8" style={{ color: 'var(--text-secondary)' }}>
          Choose the option that best describes you.
        </p>

        <div className="flex flex-col gap-4">
          {cards.map(({ id, title, subtitle, Icon, borderColor, iconBg, iconColor }) => (
            <button
              key={id}
              type="button"
              onClick={() => onSelect(id)}
              onMouseEnter={() => setHovered(id)}
              onMouseLeave={() => setHovered(null)}
              className="flex items-center gap-5 p-6 rounded-2xl text-left transition-all hover:scale-[1.01] active:scale-[0.99]"
              style={{
                background: 'var(--bg-surface)',
                border: `2px solid ${hovered === id ? borderColor : 'var(--border-edge)'}`,
              }}
            >
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
                style={{ background: iconBg }}
              >
                <Icon size={28} style={{ color: iconColor }} />
              </div>
              <div>
                <p className="font-semibold text-base" style={{ color: 'var(--text-primary)' }}>{title}</p>
                <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>{subtitle}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Step 2 — Staff path ──────────────────────────────────────────────────────
function StaffStep({ onBack }: { onBack: () => void }) {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = code.trim().toUpperCase()
    if (trimmed.length !== 8) { setError('Invite code must be 8 characters.'); return }
    setError(null)
    setLoading(true)
    try {
      const supabase = createClient()
      const { data, error: dbErr } = await (supabase as any)
        .from('profiles')
        .select('id')
        .eq('invite_code', trimmed)
        .single()

      if (dbErr || !data) {
        setError('Invalid code. Ask your hospital admin.')
        return
      }
      router.push('/portal/dashboard')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 py-12" style={{ background: 'var(--bg-base)' }}>
      <div className="w-full max-w-md">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 mb-8 text-sm transition-opacity hover:opacity-70"
          style={{ color: 'var(--text-secondary)' }}
        >
          <ArrowLeft size={16} /> Back
        </button>

        <StepIndicator step={2} total={2} />

        <div className="text-center mb-8">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: 'rgba(249,115,22,0.12)' }}
          >
            <Stethoscope size={32} style={{ color: 'var(--brand-orange)' }} />
          </div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Enter your invite code</h1>
          <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
            Your hospital administrator should have given you an 8-character code.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-widest block mb-2" style={{ color: 'var(--text-muted)' }}>
              Invite Code
            </label>
            <input
              type="text"
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              placeholder="XXXXXXXX"
              maxLength={8}
              className="w-full px-4 py-3 rounded-xl text-center font-mono text-xl tracking-widest outline-none focus:ring-2"
              style={{
                background: 'var(--bg-surface)',
                border: `2px solid ${error ? '#EF4444' : 'var(--border-edge)'}`,
                color: 'var(--text-primary)',
                letterSpacing: '0.3em',
              }}
            />
            {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
          </div>

          <button
            type="submit"
            disabled={loading || code.trim().length !== 8}
            className="w-full py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-50 hover:opacity-90"
            style={{ background: 'var(--brand-orange)', color: '#fff' }}
          >
            {loading ? 'Verifying…' : 'Join Hospital'}
          </button>
        </form>

        <p className="text-xs text-center mt-6" style={{ color: 'var(--text-muted)' }}>
          Don&rsquo;t have a code? Contact your hospital IT administrator.
        </p>
      </div>
    </div>
  )
}

// ─── Step 2 — Patient path ────────────────────────────────────────────────────
function PatientStep({ onBack }: { onBack: () => void }) {
  const [form, setForm] = useState<PatientForm>({
    full_name: '',
    phone: '',
    date_of_birth: '',
    sex: '',
    hospital_name: '',
  })
  const [hospitalSearch, setHospitalSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const router = useRouter()

  const filteredHospitals = UGANDA_HOSPITALS.filter(h =>
    h.toLowerCase().includes(hospitalSearch.toLowerCase())
  )

  const setField = (key: keyof PatientForm, value: string) =>
    setForm(prev => ({ ...prev, [key]: value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.full_name.trim()) { setError('Full name is required.'); return }
    if (!form.sex) { setError('Please select your sex.'); return }
    if (!form.hospital_name) { setError('Please select a hospital.'); return }
    setError(null)
    setLoading(true)
    try {
      const supabase = createClient()
      const user = await getCurrentUser()
      if (!user) throw new Error('Not signed in')

      const { error: dbErr } = await (supabase as any)
        .from('patient_profiles')
        .insert({
          id: user.id,
          full_name: form.full_name.trim(),
          phone: form.phone.trim() || null,
          date_of_birth: form.date_of_birth || null,
          sex: form.sex,
          hospital_name: form.hospital_name,
        })

      if (dbErr) throw dbErr
      setSuccess(true)
      setTimeout(() => router.push('/health/dashboard'), 1200)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration failed. Please try again.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-4" style={{ background: 'var(--bg-base)' }}>
        <CheckCircle size={64} style={{ color: '#22C55E' }} />
        <h2 className="text-xl font-bold mt-4" style={{ color: 'var(--text-primary)' }}>All set!</h2>
        <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>Redirecting to your health dashboard…</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 py-12" style={{ background: 'var(--bg-base)' }}>
      <div className="w-full max-w-md">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 mb-8 text-sm transition-opacity hover:opacity-70"
          style={{ color: 'var(--text-secondary)' }}
        >
          <ArrowLeft size={16} /> Back
        </button>

        <StepIndicator step={2} total={2} />

        <div className="text-center mb-8">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: 'rgba(232,184,75,0.12)' }}
          >
            <User size={32} style={{ color: 'var(--brand-gold)' }} />
          </div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Your health profile</h1>
          <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
            This helps us personalise your care.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Full Name */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-widest block mb-1.5" style={{ color: 'var(--text-muted)' }}>
              Full Name *
            </label>
            <input
              type="text"
              placeholder="Jane Namukasa"
              value={form.full_name}
              onChange={e => setField('full_name', e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)', color: 'var(--text-primary)' }}
            />
          </div>

          {/* Phone */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-widest block mb-1.5" style={{ color: 'var(--text-muted)' }}>
              Phone (optional)
            </label>
            <div className="flex gap-2">
              <div
                className="flex items-center px-3 rounded-xl text-sm font-medium shrink-0"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-edge)', color: 'var(--text-secondary)' }}
              >
                +256
              </div>
              <input
                type="tel"
                placeholder="700 000 000"
                value={form.phone}
                onChange={e => setField('phone', e.target.value)}
                className="flex-1 px-3 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)', color: 'var(--text-primary)' }}
              />
            </div>
          </div>

          {/* Date of Birth */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-widest block mb-1.5" style={{ color: 'var(--text-muted)' }}>
              Date of Birth (optional)
            </label>
            <input
              type="date"
              value={form.date_of_birth}
              onChange={e => setField('date_of_birth', e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)', color: 'var(--text-primary)' }}
            />
          </div>

          {/* Sex */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-widest block mb-1.5" style={{ color: 'var(--text-muted)' }}>
              Sex *
            </label>
            <select
              value={form.sex}
              onChange={e => setField('sex', e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-edge)',
                color: form.sex ? 'var(--text-primary)' : 'var(--text-muted)',
              }}
            >
              <option value="">Select…</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>

          {/* Hospital — searchable datalist */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-widest block mb-1.5" style={{ color: 'var(--text-muted)' }}>
              Hospital *
            </label>
            <input
              type="text"
              list="hospitals-list"
              aria-label="Hospital"
              placeholder="Search hospital…"
              value={hospitalSearch || form.hospital_name}
              onChange={e => {
                setHospitalSearch(e.target.value)
                // If exact match found in list, set it as selected value
                const match = UGANDA_HOSPITALS.find(h => h.toLowerCase() === e.target.value.toLowerCase())
                if (match) {
                  setField('hospital_name', match)
                  setHospitalSearch('')
                } else {
                  setField('hospital_name', e.target.value)
                }
              }}
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)', color: 'var(--text-primary)' }}
            />
            <datalist id="hospitals-list">
              {filteredHospitals.map(h => <option key={h} value={h} />)}
            </datalist>
          </div>

          {error && (
            <div className="px-4 py-3 rounded-xl text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.2)' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-50 hover:opacity-90"
            style={{ background: 'var(--brand-gold)', color: '#07070A' }}
          >
            {loading ? 'Creating profile…' : 'Create My Profile'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function OnboardingPage() {
  const [path, setPath] = useState<Path>(null)

  if (path === null) return <ChoosePath onSelect={setPath} />
  if (path === 'staff') return <StaffStep onBack={() => setPath(null)} />
  return <PatientStep onBack={() => setPath(null)} />
}
