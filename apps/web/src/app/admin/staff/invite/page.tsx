'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CheckCircle, Send } from 'lucide-react'
import { createClient } from '../../../../lib/supabase/client'

const ROLES = ['doctor', 'nurse', 'pharmacist', 'lab_tech', 'admin', 'clinician', 'radiologist', 'physiotherapist']

export default function AdminStaffInvitePage() {
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [hospitalId, setHospitalId] = useState<string | null>(null)
  const [form, setForm] = useState({
    full_name: '', email: '', role: '', phone: '', specialty: '',
  })

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: profile } = await (supabase as any).from('profiles').select('hospital_id').eq('id', user.id).single() as { data: { hospital_id: string } | null }
      setHospitalId(profile?.hospital_id ?? null)
    }
    load()
  }, [])

  function set(k: keyof typeof form, v: string) {
    setForm(prev => ({ ...prev, [k]: v }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!hospitalId) { setError('Could not determine your hospital. Please sign in again.'); return }
    setLoading(true)
    setError('')
    const supabase = createClient()

    const tempPassword = Math.random().toString(36).slice(2, 10) + 'Aa1!'
    // Identity creation only. Hospital authorization still requires a SYNAPSE
    // facility session (synapse_session + membership), not this Auth JWT.
    const { data, error: authError } = await supabase.auth.signUp({
      email: form.email,
      password: tempPassword,
      options: { data: { full_name: form.full_name, role: form.role } },
    })
    if (authError) { setError(authError.message); setLoading(false); return }

    if (data.user) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('profiles').upsert({
        id: data.user.id,
        full_name: form.full_name,
        email: form.email,
        phone: form.phone || null,
        role: form.role,
        specialty_confirmed: form.specialty || null,
        hospital_id: hospitalId,
        verification_status: 'verified',
        onboarding_complete: false,
      })
    }
    setSent(true)
    setLoading(false)
  }

  const inp = 'w-full rounded-xl px-4 py-3 text-sm outline-none transition-all'
  const inpStyle = { background: 'var(--bg-surface)', border: '1px solid var(--border-edge)', color: 'var(--text-primary)' }

  if (sent) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center max-w-sm mx-auto">
        <div className="flex h-16 w-16 items-center justify-center rounded-full mb-6" style={{ background: 'rgba(34,197,94,0.12)' }}>
          <CheckCircle className="h-8 w-8 text-green-500" />
        </div>
        <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Staff Account Created</h2>
        <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
          {form.full_name} can now sign in with {form.email}. They should reset their password on first login.
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => { setSent(false); setForm({ full_name: '', email: '', role: '', phone: '', specialty: '' }) }}
            className="btn-secondary"
          >
            Add Another
          </button>
          <Link href="/admin/staff" className="btn-primary">View Staff</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/staff" className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--text-muted)' }}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
      </div>
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Invite Staff Member</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Create a staff account and send login credentials.</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>Full Name *</label>
          <input required value={form.full_name} onChange={e => set('full_name', e.target.value)} placeholder="Dr. Sarah Namukasa" className={inp} style={inpStyle} />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>Email Address *</label>
          <input required type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="sarah@hospital.ug" className={inp} style={inpStyle} />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>Phone</label>
          <input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+256 7XX XXX XXX" className={inp} style={inpStyle} />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>Role *</label>
          <select required title="Staff role" value={form.role} onChange={e => set('role', e.target.value)} className={inp} style={{ ...inpStyle, WebkitAppearance: 'none', appearance: 'none' }}>
            <option value="">Select role</option>
            {ROLES.map(r => <option key={r} value={r}>{r.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>Specialty (optional)</label>
          <input value={form.specialty} onChange={e => set('specialty', e.target.value)} placeholder="e.g. Paediatrics, Cardiology" className={inp} style={inpStyle} />
        </div>
        {error && <p className="text-sm" style={{ color: '#EF4444' }}>{error}</p>}
        <button type="submit" disabled={loading || !hospitalId} className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50">
          <Send className="h-4 w-4" />
          {loading ? 'Creating account…' : 'Create Staff Account'}
        </button>
      </form>
    </div>
  )
}
