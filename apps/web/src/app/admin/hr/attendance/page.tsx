'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Clock } from 'lucide-react'
import { createClient } from '../../../../lib/supabase/client'

interface AttendanceRecord {
  id: string
  user_id: string
  clock_in: string | null
  clock_out: string | null
  date: string
  notes: string | null
  staff_name?: string
}

export default function AdminHRAttendancePage() {
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0])

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
      const { data } = await sb
        .from('attendance_records')
        .select('id, user_id, clock_in, clock_out, date, notes, profiles(full_name)')
        .eq('hospital_id', profile.hospital_id)
        .eq('date', dateFilter)
        .order('clock_in', { ascending: false }) as { data: (AttendanceRecord & { profiles?: { full_name: string } })[] | null }
      setRecords((data ?? []).map(r => ({ ...r, staff_name: r.profiles?.full_name })))
      setLoading(false)
    }
    load()
  }, [dateFilter])

  function duration(inn: string | null, out: string | null) {
    if (!inn || !out) return '—'
    const diff = (new Date(out).getTime() - new Date(inn).getTime()) / 60000
    const h = Math.floor(diff / 60), m = Math.round(diff % 60)
    return `${h}h ${m}m`
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/hr" className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--text-muted)' }}>
          <ArrowLeft className="h-4 w-4" /> HR
        </Link>
      </div>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Attendance</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{records.length} records for {dateFilter}</p>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4" style={{ color: 'var(--text-muted)' }} />
          <input type="date" title="Filter by date" value={dateFilter} onChange={e => setDateFilter(e.target.value)}
            className="rounded-xl px-3 py-2 text-sm outline-none"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)', color: 'var(--text-primary)' }} />
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Loading attendance…</div>
      ) : records.length === 0 ? (
        <div className="py-16 text-center text-sm" style={{ color: 'var(--text-muted)' }}>No attendance records for this date.</div>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border-edge)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-edge)' }}>
                {['Staff', 'Clock In', 'Clock Out', 'Duration', 'Notes'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.map((r, i) => (
                <tr key={r.id} style={{ background: i % 2 === 0 ? 'var(--bg-base)' : 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)' }}>
                  <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-primary)' }}>{r.staff_name ?? r.user_id.slice(0, 8)}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>
                    {r.clock_in ? new Date(r.clock_in).toLocaleTimeString('en-UG', { hour: '2-digit', minute: '2-digit' }) : '—'}
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>
                    {r.clock_out ? new Date(r.clock_out).toLocaleTimeString('en-UG', { hour: '2-digit', minute: '2-digit' }) : '—'}
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-primary)' }}>{duration(r.clock_in, r.clock_out)}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>{r.notes ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
