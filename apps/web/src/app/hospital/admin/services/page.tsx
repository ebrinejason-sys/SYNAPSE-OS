'use client'

import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'

interface Service {
  id: string
  name: string
  service_type: string
  price: number
  currency: string
}

function errorText(data: unknown, fallback: string): string {
  if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>
    if (typeof d.message === 'string') return d.message
    if (typeof d.error === 'string') return d.error
  }
  return fallback
}

export default function HospitalAdminServicesPage() {
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ name: '', service_type: 'consultation', price: '' })

  async function load() {
    const res = await fetch('/api/hospital/admin/services')
    const data = await res.json()
    if (!res.ok) setError(errorText(data, 'Failed to load'))
    else setServices(data.services ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function add() {
    if (!form.name.trim() || !form.price) return
    const res = await fetch('/api/hospital/admin/services', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: form.name.trim(), service_type: form.service_type, price: Number(form.price), currency: 'UGX' }),
    })
    if (!res.ok) {
      const data = await res.json()
      setError(errorText(data, 'Create failed'))
      return
    }
    setForm({ name: '', service_type: 'consultation', price: '' })
    await load()
  }

  async function remove(id: string) {
    if (!confirm('Remove this service?')) return
    await fetch(`/api/hospital/admin/services/${id}`, { method: 'DELETE' })
    setServices((prev) => prev.filter((s) => s.id !== id))
  }

  function formatUgx(amount: number) {
    return new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', maximumFractionDigits: 0 }).format(amount)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Service catalog</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Billable services priced in UGX (requires billing module)</p>
      </div>
      {error && <div className="rounded-xl px-4 py-3 text-sm text-red-500" style={{ background: 'rgba(239,68,68,0.1)' }}>{error}</div>}
      <div className="rounded-2xl p-5 space-y-3" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)' }}>
        <div className="grid grid-cols-3 gap-2">
          <input placeholder="Service name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="rounded-xl px-3 py-2 text-sm outline-none" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-edge)', color: 'var(--text-primary)' }} />
          <select title="Service type" value={form.service_type} onChange={(e) => setForm((f) => ({ ...f, service_type: e.target.value }))} className="rounded-xl px-3 py-2 text-sm outline-none" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-edge)', color: 'var(--text-primary)' }}>
            {['consultation', 'procedure', 'lab', 'imaging', 'bed_day', 'supply', 'other'].map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <input placeholder="Price (UGX)" type="number" min={0} value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} className="rounded-xl px-3 py-2 text-sm outline-none" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-edge)', color: 'var(--text-primary)' }} />
        </div>
        <button type="button" onClick={add} className="btn-primary text-sm flex items-center gap-2"><Plus className="h-4 w-4" /> Add service</button>
      </div>
      {loading ? <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading…</p> : (
        <div className="space-y-2">
          {services.map((svc) => (
            <div key={svc.id} className="flex items-center justify-between rounded-xl px-4 py-3" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)' }}>
              <div>
                <p className="text-sm font-medium">{svc.name}</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{svc.service_type} · {formatUgx(svc.price)}</p>
              </div>
              <button type="button" onClick={() => remove(svc.id)} style={{ color: '#EF4444' }}><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
