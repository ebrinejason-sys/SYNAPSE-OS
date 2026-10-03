'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

interface StaffMember {
  id: string
  full_name: string | null
  role: string | null
  department: string | null
  base_salary_ugx: number | null
}

export default function AdminHRPayrollPage() {
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [editId, setEditId] = useState<string | null>(null)
  const [salaryInput, setSalaryInput] = useState('')
  const [saving, setSaving] = useState(false)

  // Reads and writes go through server routes (service role, facility admin
  // session + staff capability, tenant scoped). The browser never writes profiles.
  async function load() {
    const res = await fetch('/api/hospital/admin/payroll', { cache: 'no-store' })
    const data = res.ok ? await res.json().catch(() => null) : null
    setStaff((data?.staff ?? []) as StaffMember[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function saveSalary(staffId: string) {
    const val = parseFloat(salaryInput.replace(/,/g, ''))
    if (isNaN(val) || val < 0) return
    setSaving(true)
    await fetch(`/api/hospital/admin/payroll/${encodeURIComponent(staffId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base_salary_ugx: val }),
    })
    setEditId(null)
    setSalaryInput('')
    setSaving(false)
    await load()
  }

  const totalPayroll = staff.reduce((s, m) => s + (m.base_salary_ugx ?? 0), 0)
  const fmt = (n: number | null) =>
    n ? new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', maximumFractionDigits: 0 }).format(n) : 'Not set'

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/hr" className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--text-muted)' }}>
          <ArrowLeft className="h-4 w-4" /> HR
        </Link>
      </div>
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Payroll</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Monthly payroll total: {fmt(totalPayroll)}</p>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Loading staff…</div>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border-edge)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-edge)' }}>
                {['Staff', 'Role', 'Department', 'Monthly Salary (UGX)', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {staff.map((m, i) => (
                <tr key={m.id} style={{ background: i % 2 === 0 ? 'var(--bg-base)' : 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)' }}>
                  <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-primary)' }}>{m.full_name ?? '—'}</td>
                  <td className="px-4 py-3 capitalize" style={{ color: 'var(--text-secondary)' }}>{m.role ?? '—'}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{m.department ?? '—'}</td>
                  <td className="px-4 py-3">
                    {editId === m.id ? (
                      <input type="number" value={salaryInput}
                        onChange={e => setSalaryInput(e.target.value)}
                        className="w-36 rounded-lg px-3 py-1.5 text-sm outline-none"
                        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-edge)', color: 'var(--text-primary)' }}
                        placeholder="Amount" />
                    ) : (
                      <span style={{ color: m.base_salary_ugx ? 'var(--text-primary)' : 'var(--text-muted)' }}>{fmt(m.base_salary_ugx)}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {editId === m.id ? (
                      <div className="flex gap-2 justify-end">
                        <button type="button" onClick={() => saveSalary(m.id)} disabled={saving}
                          className="text-xs rounded-lg px-3 py-1.5 font-semibold disabled:opacity-60"
                          style={{ background: 'var(--brand-orange)', color: '#07070A' }}>
                          {saving ? '…' : 'Save'}
                        </button>
                        <button type="button" onClick={() => setEditId(null)}
                          className="text-xs rounded-lg px-3 py-1.5"
                          style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)', border: '1px solid var(--border-edge)' }}>
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button type="button"
                        onClick={() => { setEditId(m.id); setSalaryInput(String(m.base_salary_ugx ?? '')) }}
                        className="text-xs rounded-lg px-3 py-1.5"
                        style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border-edge)' }}>
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
