'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { ShoppingCart, CheckCircle, Clock } from 'lucide-react'
import { createClient } from '../../../lib/supabase/client'
import { getCurrentUser } from '@/lib/auth/getCurrentUser'

interface DispenseRequest {
  id: string
  patient_name: string | null
  patient_id: string | null
  drug_name: string
  quantity: number | null
  instructions: string | null
  status: string
  created_at: string | null
  prescribed_by: string | null
}

const STATUS_STYLE: Record<string, { background: string; color: string }> = {
  pending:    { background: 'rgba(234,179,8,0.1)',  color: '#EAB308' },
  dispensed:  { background: 'rgba(34,197,94,0.1)',  color: '#22C55E' },
  cancelled:  { background: 'rgba(107,114,128,0.1)', color: '#6B7280' },
  on_hold:    { background: 'rgba(239,68,68,0.1)',  color: '#EF4444' },
}

export default function PharmacyQueuePage() {
  const [queue, setQueue] = useState<DispenseRequest[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    const supabase = createClient()
    const user = await getCurrentUser()
    if (!user) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any
    const { data: profile } = await sb.from('profiles').select('hospital_id').eq('id', user.id).single() as { data: { hospital_id: string } | null }
    if (!profile?.hospital_id) { setLoading(false); return }
    const { data } = await sb
      .from('dispense_requests')
      .select('id, patient_name, patient_id, drug_name, quantity, instructions, status, created_at, prescribed_by')
      .eq('hospital_id', profile.hospital_id)
      .order('created_at', { ascending: true })
      .limit(100) as { data: DispenseRequest[] | null }
    setQueue(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function dispense(id: string) {
    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('dispense_requests').update({ status: 'dispensed', dispensed_at: new Date().toISOString() }).eq('id', id)
    await load()
  }

  const pending = queue.filter(q => q.status === 'pending')
  const done = queue.filter(q => q.status !== 'pending')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Dispense Queue</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            {pending.length} pending · {done.length} dispensed today
          </p>
        </div>
        <button type="button" onClick={load}
          className="rounded-xl px-4 py-2 text-sm"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)', color: 'var(--text-secondary)' }}>
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Loading queue…</div>
      ) : queue.length === 0 ? (
        <div className="py-16 text-center">
          <ShoppingCart className="h-10 w-10 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Queue is empty.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {queue.map(item => (
            <div key={item.id}
              className="flex items-center gap-4 rounded-2xl px-4 py-3"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)' }}>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl shrink-0"
                style={{ background: item.status === 'pending' ? 'rgba(249,115,22,0.1)' : 'rgba(34,197,94,0.08)', color: item.status === 'pending' ? 'var(--brand-orange)' : '#22C55E' }}>
                {item.status === 'pending' ? <Clock className="h-5 w-5" /> : <CheckCircle className="h-5 w-5" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{item.drug_name}</p>
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-bold capitalize"
                    style={STATUS_STYLE[item.status] ?? STATUS_STYLE.pending}>
                    {item.status}
                  </span>
                </div>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                  {item.patient_name ?? 'Patient'} · Qty: {item.quantity ?? '—'}
                  {item.instructions ? ` · ${item.instructions}` : ''}
                </p>
              </div>
              {item.status === 'pending' && (
                <button type="button" onClick={() => dispense(item.id)}
                  className="rounded-xl px-3 py-1.5 text-xs font-bold shrink-0 transition-all"
                  style={{ background: 'var(--brand-orange)', color: '#07070A' }}>
                  Dispense
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
