'use client'

import { useEffect, useState } from 'react'

export default function HospitalAdminSettingsPage() {
  const [form, setForm] = useState({
    hospital_name: '',
    address: '',
    email: '',
    phone: '',
    currency_code: 'UGX',
    tax_rate_percent: 0,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetch('/api/hospital/admin/settings')
      .then((r) => r.json())
      .then((d) => {
        if (d.settings) {
          setForm({
            hospital_name: d.settings.hospital_name ?? '',
            address: d.settings.address ?? '',
            email: d.settings.email ?? '',
            phone: d.settings.phone ?? '',
            currency_code: d.settings.currency_code ?? 'UGX',
            tax_rate_percent: d.settings.tax_rate_percent ?? 0,
          })
        }
      })
      .finally(() => setLoading(false))
  }, [])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMessage('')
    const res = await fetch('/api/hospital/admin/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    setSaving(false)
    setMessage(res.ok ? 'Settings saved.' : (data.error?.message ?? data.error ?? 'Save failed'))
  }

  const inp = 'w-full rounded-xl px-4 py-2.5 text-sm outline-none'
  const inpStyle = { background: 'var(--bg-elevated)', border: '1px solid var(--border-edge)', color: 'var(--text-primary)' }

  if (loading) return <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading…</p>

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Facility settings</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Hospital profile and billing defaults</p>
      </div>
      <form onSubmit={save} className="space-y-4 rounded-2xl p-5" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)' }}>
        {[
          { key: 'hospital_name' as const, label: 'Hospital name' },
          { key: 'address' as const, label: 'Address' },
          { key: 'email' as const, label: 'Email' },
          { key: 'phone' as const, label: 'Phone' },
        ].map((f) => (
          <div key={f.key}>
            <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>{f.label}</label>
            <input className={inp} style={inpStyle} value={form[f.key] ?? ''} onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))} />
          </div>
        ))}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>Currency</label>
            <input className={inp} style={inpStyle} value={form.currency_code} onChange={(e) => setForm((p) => ({ ...p, currency_code: e.target.value.toUpperCase() }))} />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>Tax rate (%)</label>
            <input type="number" min={0} max={100} className={inp} style={inpStyle} value={form.tax_rate_percent}
              onChange={(e) => setForm((p) => ({ ...p, tax_rate_percent: Number(e.target.value) }))} />
          </div>
        </div>
        {message && <p className="text-sm" style={{ color: message.includes('saved') ? '#22C55E' : '#EF4444' }}>{message}</p>}
        <button type="submit" disabled={saving} className="btn-primary text-sm disabled:opacity-50">{saving ? 'Saving…' : 'Save settings'}</button>
      </form>
    </div>
  )
}
