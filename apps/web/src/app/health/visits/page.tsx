'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { Calendar, ChevronRight, Stethoscope } from 'lucide-react'
import { createClient } from '../../../lib/supabase/client'

interface Visit {
  id: string
  created_at: string
  chief_complaint: string | null
  status: string | null
  department_id: string | null
}

export default function HealthVisitsPage() {
  const [visits, setVisits] = useState<Visit[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from('encounters')
        .select('id, created_at, chief_complaint, status, department_id')
        .eq('patient_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50) as { data: Visit[] | null }

      setVisits(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Visit History</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>Your hospital and clinic visits</p>
      </div>

      {loading ? (
        <div className="py-12 text-center" style={{ color: 'var(--text-muted)' }}>Loading visits…</div>
      ) : visits.length === 0 ? (
        <div className="py-12 text-center">
          <Calendar className="h-10 w-10 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No visits recorded yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {visits.map(v => (
            <div
              key={v.id}
              className="flex items-center gap-4 rounded-2xl p-4"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)' }}
            >
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl shrink-0"
                style={{ background: 'rgba(59,130,246,0.1)', color: '#3B82F6' }}
              >
                <Stethoscope className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                  {v.chief_complaint ?? 'General consultation'}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {new Date(v.created_at).toLocaleDateString('en-UG', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                </p>
              </div>
              {v.status && (
                <span
                  className="rounded-full px-2 py-0.5 text-xs font-semibold capitalize shrink-0"
                  style={{
                    background: v.status === 'completed' ? 'rgba(34,197,94,0.1)' : 'rgba(234,179,8,0.1)',
                    color: v.status === 'completed' ? '#22C55E' : '#EAB308',
                  }}
                >
                  {v.status}
                </span>
              )}
              <ChevronRight className="h-4 w-4 shrink-0" style={{ color: 'var(--text-muted)' }} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
