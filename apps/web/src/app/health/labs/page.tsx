'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { FlaskConical } from 'lucide-react'
import { createClient } from '../../../lib/supabase/client'

interface LabResult {
  id: string
  test_name: string | null
  result_value: string | null
  unit: string | null
  reference_range: string | null
  flag: string | null
  status: string | null
  created_at: string
  notes: string | null
}

export default function HealthLabsPage() {
  const [results, setResults] = useState<LabResult[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'abnormal'>('all')

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from('lab_results')
        .select('id, test_name, result_value, unit, reference_range, flag, status, created_at, notes')
        .eq('patient_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100) as { data: LabResult[] | null }

      setResults(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const shown = filter === 'abnormal'
    ? results.filter(r => r.flag && r.flag !== 'normal')
    : results

  function flagColor(flag: string | null) {
    if (!flag || flag === 'normal') return { bg: 'rgba(34,197,94,0.1)', color: '#22C55E' }
    if (flag === 'high' || flag === 'H') return { bg: 'rgba(239,68,68,0.1)', color: '#EF4444' }
    if (flag === 'low' || flag === 'L') return { bg: 'rgba(59,130,246,0.1)', color: '#3B82F6' }
    return { bg: 'rgba(234,179,8,0.1)', color: '#EAB308' }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Lab Results</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>Your laboratory test results</p>
      </div>

      {results.length > 0 && (
        <div className="flex gap-2">
          {(['all', 'abnormal'] as const).map(f => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className="rounded-full px-3 py-1.5 text-xs font-semibold capitalize transition-all"
              style={{
                background: filter === f ? 'var(--brand-orange)' : 'var(--bg-elevated)',
                color: filter === f ? '#07070A' : 'var(--text-secondary)',
                border: `1px solid ${filter === f ? 'var(--brand-orange)' : 'var(--border-edge)'}`,
              }}
            >
              {f === 'all' ? `All (${results.length})` : `Abnormal (${results.filter(r => r.flag && r.flag !== 'normal').length})`}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center" style={{ color: 'var(--text-muted)' }}>Loading lab results…</div>
      ) : shown.length === 0 ? (
        <div className="py-12 text-center">
          <FlaskConical className="h-10 w-10 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {filter === 'abnormal' ? 'No abnormal results found.' : 'No lab results on record.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {shown.map(r => {
            const fc = flagColor(r.flag)
            return (
              <div
                key={r.id}
                className="rounded-2xl p-4"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)' }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                      {r.test_name ?? 'Unknown test'}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {new Date(r.created_at).toLocaleDateString('en-UG', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>
                      {r.result_value ?? '—'} <span className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}>{r.unit}</span>
                    </p>
                    {r.reference_range && (
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Ref: {r.reference_range}</p>
                    )}
                  </div>
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase shrink-0" style={fc}>
                    {r.flag ?? 'normal'}
                  </span>
                </div>
                {r.notes && (
                  <p className="text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>{r.notes}</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
