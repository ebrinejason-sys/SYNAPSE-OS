'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, FileText } from 'lucide-react'
import { createClient } from '../../../../lib/supabase/client'

interface Invoice {
  id: string
  invoice_number: string | null
  patient_id: string | null
  total_amount: number | null
  paid_amount: number | null
  status: string
  due_date: string | null
  created_at: string | null
}

const STATUS_STYLE: Record<string, { background: string; color: string }> = {
  draft:     { background: 'rgba(107,114,128,0.1)', color: '#6B7280' },
  sent:      { background: 'rgba(59,130,246,0.1)',  color: '#3B82F6' },
  paid:      { background: 'rgba(34,197,94,0.1)',   color: '#22C55E' },
  partial:   { background: 'rgba(234,179,8,0.1)',   color: '#EAB308' },
  overdue:   { background: 'rgba(239,68,68,0.1)',   color: '#EF4444' },
  cancelled: { background: 'rgba(107,114,128,0.1)', color: '#6B7280' },
}

export default function AdminInvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any
      const { data: profile } = await sb.from('profiles').select('hospital_id').eq('id', user.id).single() as { data: { hospital_id: string } | null }
      if (!profile?.hospital_id) { setLoading(false); return }
      const { data } = await sb.from('invoices')
        .select('id, invoice_number, patient_id, total_amount, paid_amount, status, due_date, created_at')
        .eq('hospital_id', profile.hospital_id)
        .order('created_at', { ascending: false })
        .limit(100) as { data: Invoice[] | null }
      setInvoices(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const fmt = (n: number | null) =>
    n ? new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', maximumFractionDigits: 0 }).format(n) : '—'

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/finance" className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--text-muted)' }}>
          <ArrowLeft className="h-4 w-4" /> Finance
        </Link>
      </div>
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Invoices</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{invoices.length} invoices</p>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Loading invoices…</div>
      ) : invoices.length === 0 ? (
        <div className="py-16 text-center">
          <FileText className="h-10 w-10 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No invoices yet.</p>
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border-edge)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-edge)' }}>
                {['Invoice #', 'Total', 'Paid', 'Balance', 'Status', 'Due Date'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv, i) => (
                <tr key={inv.id} style={{ background: i % 2 === 0 ? 'var(--bg-base)' : 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)' }}>
                  <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--text-primary)' }}>
                    {inv.invoice_number ?? inv.id.slice(0, 8)}
                  </td>
                  <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-primary)' }}>{fmt(inv.total_amount)}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{fmt(inv.paid_amount)}</td>
                  <td className="px-4 py-3" style={{ color: '#EF4444' }}>
                    {fmt((inv.total_amount ?? 0) - (inv.paid_amount ?? 0))}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full px-2 py-0.5 text-xs font-semibold capitalize"
                      style={STATUS_STYLE[inv.status] ?? STATUS_STYLE.draft}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                    {inv.due_date ? new Date(inv.due_date).toLocaleDateString('en-UG') : '—'}
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
