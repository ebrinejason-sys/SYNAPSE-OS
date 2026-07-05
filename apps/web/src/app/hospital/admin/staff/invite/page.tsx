'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CheckCircle } from 'lucide-react'

const ROLES = [
  'doctor', 'nurse', 'pharmacist', 'lab_tech', 'receptionist',
  'billing_officer', 'claims_officer', 'clinical_officer', 'hospital_admin',
]

export default function HospitalAdminStaffInvitePage() {
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ full_name: '', email: '', role: 'nurse', phone: '' })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await fetch('/api/hospital/admin/staff/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, phone: form.phone || null }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) {
      setError(typeof data.error === 'string' ? data.error : 'Invite failed')
      return
    }
    setSent(true)
  }

  const inp = 'w-full rounded-xl px-4 py-3 text-sm outline-none'
  const inpStyle = { background: 'var(--bg-surface)', border: '1px solid var(--border-edge)', color: 'var(--text-primary)' }

  if (sent) {
    return (
      <div className="max-w-md mx-auto py-16 text-center space-y-4">
        <CheckCircle className="h-12 w-12 mx-auto text-green-500" />
        <h2 className="text-xl font-bold">Staff account created</h2>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          {form.full_name} will receive login credentials at {form.email}.
        </p>
        <Link href="/hospital/admin/staff" className="btn-primary text-sm inline-block">Back to staff</Link>
      </div>
    )
  }

  return (
    <div className="max-w-lg space-y-6">
      <Link href="/hospital/admin/staff" className="inline-flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>
      <div>
        <h1 className="text-2xl font-bold">Invite staff</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Custom auth profile with must-change-password</p>
      </div>
      <form onSubmit={submit} className="space-y-4">
        <input required placeholder="Full name" className={inp} style={inpStyle} value={form.full_name} onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))} />
        <input required type="email" placeholder="Email" className={inp} style={inpStyle} value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
        <input placeholder="Phone (optional)" className={inp} style={inpStyle} value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
        <select title="Role" value={form.role} onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))} className={inp} style={inpStyle}>
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button type="submit" disabled={loading} className="btn-primary text-sm disabled:opacity-50">{loading ? 'Creating…' : 'Create staff account'}</button>
      </form>
    </div>
  )
}
