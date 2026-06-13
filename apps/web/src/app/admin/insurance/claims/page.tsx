'use client'
import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, FileText, RefreshCw } from 'lucide-react'
import { createClient } from '../../../../lib/supabase/client'
import { getCurrentUser } from '@/lib/auth/getCurrentUser'

interface Claim {
  id: string
  claim_number: string | null
  insurer_name: string | null
  billed_amount: number | null
  paid_amount: number | null
  status: string
  service_from: string | null
  submitted_at: string | null
  primary_icd11: string | null
  patient_id: string | null
}

const STATUS_COLORS: Record<string, React.CSSProperties> = {
  pending:    { background: 'rgba(234,179,8,0.1)',   color: '#EAB308' },
  submitted:  { background: 'rgba(59,130,246,0.1)',  color: '#3B82F6' },
  approved:   { background: 'rgba(34,197,94,0.1)',   color: '#22C55E' },
  paid:       { background: 'rgba(34,197,94,0.15)',  color: '#16A34A' },
  denied:     { background: 'rgba(239,68,68,0.1)',   color: '#EF4444' },
  appealed:   { background: 'rgba(249,115,22,0.1)',  color: '#F97316' },
}

export const dynamic = 'force-dynamic'

export default function AdminClaimsPage() {
  const [claims, setClaims] = useState<Claim[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const user = await getCurrentUser()
      if (!user) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: profile } = await (supabase as any).from('profiles').select('hospital_id').eq('id', user.id).single() as { data: { hospital_id: string } | null }
      if (!profile?.hospital_id) { setLoading(false); return }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from('insurance_claims')
        .select('id, claim_number, insurer_name, billed_amount, paid_amount, status, service_from, submitted_at, primary_icd11, patient_id')
        .eq('hospital_id', profile.hospital_id)
        .order('submitted_at', { ascending: false })
        .limit(200) as { data: Claim[] | null }
      setClaims(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const filtered = statusFilter === 'all'
    ? claims
    : claims.filter(c => c.status === statusFilter)

  const totalBilled = filtered.reduce((s, c) => s + (c.billed_amount ?? 0), 0)
  const totalPaid = filtered.reduce((s, c) => s + (c.paid_amount ?? 0), 0)

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', maximumFractionDigits: 0 }).format(n)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/insurance" className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--text-muted)' }}>
          <ArrowLeft className="h-4 w-4" /> Insurance
        </Link>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Insurance Claims</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{claims.length} total claims</p>
        </div>
        <Link href="/admin/insurance" className="flex items-center gap-2 text-sm rounded-xl px-4 py-2"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)', color: 'var(--text-secondary)' }}>
          <RefreshCw className="h-4 w-4" /> Refresh
        </Link>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: 'Total Claims', value: filtered.length.toString(), sub: null },
          { label: 'Total Billed', value: fmt(totalBilled), sub: null },
          { label: 'Total Paid', value: fmt(totalPaid), sub: null },
          { label: 'Recovery Rate', value: totalBilled > 0 ? `${Math.round((totalPaid / totalBilled) * 100)}%` : '—', sub: null },
        ].map(card => (
          <div key={card.label} className="rounded-2xl p-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)' }}>
            <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>{card.label}</p>
            <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Status filter */}
      <div className="flex gap-2 flex-wrap">
        {['all', 'pending', 'submitted', 'approved', 'paid', 'denied', 'appealed'].map(s => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className="rounded-full px-3 py-1.5 text-xs font-semibold capitalize transition-all"
            style={{
              background: statusFilter === s ? 'var(--brand-orange)' : 'var(--bg-elevated)',
              color: statusFilter === s ? '#07070A' : 'var(--text-secondary)',
              border: `1px solid ${statusFilter === s ? 'var(--brand-orange)' : 'var(--border-edge)'}`,
            }}
          >
            {s === 'all' ? 'All' : s}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="py-16 text-center" style={{ color: 'var(--text-muted)' }}>Loading claims…</div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center">
          <FileText className="h-10 w-10 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No claims found.</p>
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border-edge)' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-edge)' }}>
                  {['CLAIM #', 'INSURER', 'BILLED', 'PAID', 'STATUS', 'DATE', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((c, i) => {
                  const sc = STATUS_COLORS[c.status] ?? { background: 'rgba(107,114,128,0.1)', color: '#6B7280' }
                  return (
                    <tr
                      key={c.id}
                      style={{
                        background: i % 2 === 0 ? 'var(--bg-base)' : 'var(--bg-surface)',
                        borderBottom: '1px solid var(--border-subtle)',
                      }}
                    >
                      <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--text-primary)' }}>
                        {c.claim_number ?? c.id.slice(0, 8)}
                      </td>
                      <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>
                        {c.insurer_name ?? '—'}
                      </td>
                      <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-primary)' }}>
                        {c.billed_amount ? fmt(c.billed_amount) : '—'}
                      </td>
                      <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>
                        {c.paid_amount ? fmt(c.paid_amount) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-full px-2 py-0.5 text-xs font-semibold capitalize" style={sc}>
                          {c.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                        {c.submitted_at ? new Date(c.submitted_at).toLocaleDateString('en-UG') : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {c.status === 'denied' && (
                          <Link
                            href={`/admin/insurance/appeals?claimId=${c.id}`}
                            className="text-xs rounded-lg px-3 py-1.5 transition-all"
                            style={{ background: 'rgba(249,115,22,0.1)', color: 'var(--brand-orange)', border: '1px solid var(--border-orange)' }}
                          >
                            Appeal
                          </Link>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
