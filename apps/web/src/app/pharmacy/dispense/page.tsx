'use client'
export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { FlaskConical, CheckCircle } from 'lucide-react'
import { createClient } from '../../../lib/supabase/client'
import { getCurrentUser } from '@/lib/auth/getCurrentUser'

export default function PharmacyDispensePage() {
  const [form, setForm] = useState({
    patient_name: '',
    drug_name: '',
    quantity: '',
    instructions: '',
    prescribed_by: '',
  })
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.drug_name.trim() || !form.quantity.trim()) {
      setError('Drug name and quantity are required.')
      return
    }
    setSaving(true)
    setError('')
    const supabase = createClient()
    const user = await getCurrentUser()
    if (!user) { setSaving(false); return }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any
    const { data: profile } = await sb.from('profiles').select('hospital_id').eq('id', user.id).single() as { data: { hospital_id: string } | null }
    if (!profile?.hospital_id) { setSaving(false); return }

    const { error: dbErr } = await sb.from('dispense_requests').insert({
      hospital_id: profile.hospital_id,
      patient_name: form.patient_name || null,
      drug_name: form.drug_name,
      quantity: parseInt(form.quantity),
      instructions: form.instructions || null,
      prescribed_by: form.prescribed_by || null,
      status: 'dispensed',
      dispensed_at: new Date().toISOString(),
      dispensed_by: user.id,
    })

    setSaving(false)
    if (dbErr) {
      setError('Failed to record dispense.')
    } else {
      setDone(true)
      setForm({ patient_name: '', drug_name: '', quantity: '', instructions: '', prescribed_by: '' })
      setTimeout(() => setDone(false), 3000)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Record Dispense</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Log a drug dispensed to a patient</p>
      </div>

      {done && (
        <div className="flex items-center gap-3 rounded-2xl p-4"
          style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
          <CheckCircle className="h-5 w-5" style={{ color: '#22C55E' }} />
          <p className="text-sm font-semibold" style={{ color: '#22C55E' }}>Dispense recorded successfully.</p>
        </div>
      )}

      {error && (
        <p className="text-sm" style={{ color: '#EF4444' }}>{error}</p>
      )}

      <form onSubmit={submit} className="space-y-4 max-w-lg">
        {[
          { key: 'patient_name', label: 'Patient Name', placeholder: 'Full name (optional)', required: false },
          { key: 'drug_name', label: 'Drug Name *', placeholder: 'e.g. Amoxicillin 500mg', required: true },
          { key: 'quantity', label: 'Quantity *', placeholder: 'e.g. 21 tablets', required: true },
          { key: 'instructions', label: 'Instructions', placeholder: 'e.g. Take 1 tablet 3x daily with food', required: false },
          { key: 'prescribed_by', label: 'Prescribed By', placeholder: "Doctor's name", required: false },
        ].map(field => (
          <div key={field.key}>
            <label className="block text-sm font-semibold mb-1.5" style={{ color: 'var(--text-primary)' }}>
              {field.label}
            </label>
            <input
              type="text"
              value={form[field.key as keyof typeof form]}
              onChange={e => setForm(prev => ({ ...prev, [field.key]: e.target.value }))}
              placeholder={field.placeholder}
              required={field.required}
              className="w-full rounded-xl px-4 py-2.5 text-sm outline-none"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)', color: 'var(--text-primary)' }}
            />
          </div>
        ))}

        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-bold disabled:opacity-60 transition-all"
          style={{ background: 'var(--brand-orange)', color: '#07070A' }}
        >
          <FlaskConical className="h-4 w-4" />
          {saving ? 'Saving…' : 'Record Dispense'}
        </button>
      </form>
    </div>
  )
}
