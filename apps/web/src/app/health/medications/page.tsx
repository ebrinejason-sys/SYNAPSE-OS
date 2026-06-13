'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { AlertCircle, Pill } from 'lucide-react'
import { createClient } from '../../../lib/supabase/client'

interface MedOrder {
  id: string
  drug_name: string | null
  dosage: string | null
  frequency: string | null
  route: string | null
  status: string | null
  created_at: string
  notes: string | null
}

export default function HealthMedicationsPage() {
  const [meds, setMeds] = useState<MedOrder[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const meRes = await fetch('/api/auth/me')
      const { user } = meRes.ok ? await meRes.json() : { user: null }
      if (!user) { setLoading(false); return }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from('encounter_orders')
        .select('id, drug_name, dosage, frequency, route, status, created_at, notes')
        .eq('patient_id', user.id)
        .eq('order_type', 'medication')
        .order('created_at', { ascending: false })
        .limit(100) as { data: MedOrder[] | null }

      setMeds(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const active = meds.filter(m => m.status === 'active' || m.status === 'dispensed')
  const past = meds.filter(m => m.status !== 'active' && m.status !== 'dispensed')

  function MedCard({ med }: { med: MedOrder }) {
    return (
      <div
        className="flex items-start gap-3 rounded-2xl p-4"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)' }}
      >
        <div
          className="flex h-9 w-9 items-center justify-center rounded-xl shrink-0 mt-0.5"
          style={{ background: 'rgba(139,92,246,0.1)', color: '#8B5CF6' }}
        >
          <Pill className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
            {med.drug_name ?? 'Unknown medication'}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            {[med.dosage, med.frequency, med.route ? `(${med.route})` : null].filter(Boolean).join(' · ')}
          </p>
          {med.notes && (
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{med.notes}</p>
          )}
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            Prescribed {new Date(med.created_at).toLocaleDateString('en-UG', { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase shrink-0"
          style={{
            background: (med.status === 'active' || med.status === 'dispensed') ? 'rgba(34,197,94,0.1)' : 'rgba(107,114,128,0.1)',
            color: (med.status === 'active' || med.status === 'dispensed') ? '#22C55E' : '#6B7280',
          }}
        >
          {med.status ?? 'ordered'}
        </span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Medications</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>Your prescribed medications</p>
      </div>

      {loading ? (
        <div className="py-12 text-center" style={{ color: 'var(--text-muted)' }}>Loading medications…</div>
      ) : meds.length === 0 ? (
        <div className="py-12 text-center">
          <Pill className="h-10 w-10 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No medications on record.</p>
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="h-4 w-4" style={{ color: '#22C55E' }} />
                <h2 className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>ACTIVE ({active.length})</h2>
              </div>
              {active.map(m => <MedCard key={m.id} med={m} />)}
            </div>
          )}
          {past.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-muted)' }}>PAST ({past.length})</h2>
              {past.map(m => <MedCard key={m.id} med={m} />)}
            </div>
          )}
        </>
      )}
    </div>
  )
}
