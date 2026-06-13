'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CreditCard } from 'lucide-react'
import { createClient } from '../../../../lib/supabase/client'

interface Payment {
  id: string
  amount: number | null
  method: string | null
  reference: string | null
  status: string
  created_at: string | null
}

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const meRes = await fetch('/api/auth/me')
      const { user } = meRes.ok ? await meRes.json() : { user: null }
      if (!user) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any
      const { data: profile } = await sb.from('profiles').select('hospital_id').eq('id', user.id).single() as { data: { hospital_id: string } | null }
      if (!profile?.hospital_id) { setLoading(false); return }
      const { data } = await sb.from('payments')
        .select('id, amount, method, reference, status, created_at')
        .eq('hospital_id', profile.hospital_id)
        .order('created_at', { ascending: false })
        .limit(100) as { data: Payment[] | null }
      setPayments(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const total = payments.filter(p => p.status === 'completed').reduce((s, p) => s + (p.amount ?? 0), 0)
  const fmt = (n: number | null) =>
    n ? new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', maximumFractionDigits: 0 }).format(n) : '—'

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/finance" className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--text-muted)' }}>
          <ArrowLeft className="h-4 w-4" /> Finance
        </Link>
      </div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Payments</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Total received: {fmt(total)}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{ background: 'rgba(34,197,94,0.1)', color: '#22C55E' }}>
          <CreditCard className="h-5 w-5" />
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Loading payments…</div>
      ) : payments.length === 0 ? (
        <div className="py-16 text-center text-sm" style={{ color: 'var(--text-muted)' }}>No payments recorded yet.</div>
      ) : (
        <div className="space-y-2">
          {payments.map(p => (
            <div key={p.id}
              className="flex items-center gap-4 rounded-xl px-4 py-3"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)' }}>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg shrink-0"
                style={{ background: 'rgba(34,197,94,0.1)', color: '#22C55E' }}>
                <CreditCard className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{fmt(p.amount)}</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {p.method ?? 'Unknown'}{p.reference ? ` · ${p.reference}` : ''}
                </p>
              </div>
              <div className="text-right shrink-0">
                <span className="text-xs rounded-full px-2 py-0.5 capitalize"
                  style={{
                    background: p.status === 'completed' ? 'rgba(34,197,94,0.1)' : 'rgba(234,179,8,0.1)',
                    color: p.status === 'completed' ? '#22C55E' : '#EAB308',
                  }}>
                  {p.status}
                </span>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  {p.created_at ? new Date(p.created_at).toLocaleDateString('en-UG') : ''}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
