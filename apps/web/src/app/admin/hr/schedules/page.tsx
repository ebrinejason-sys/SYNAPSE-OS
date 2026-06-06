'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '../../../../lib/supabase/client'

interface Shift {
  id: string
  staff_id: string
  shift_date: string
  start_time: string
  end_time: string
  department: string | null
  staff_name?: string
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function AdminHRSchedulesPage() {
  const [shifts, setShifts] = useState<Shift[]>([])
  const [loading, setLoading] = useState(true)
  const [weekOffset, setWeekOffset] = useState(0)

  const weekStart = (() => {
    const d = new Date()
    d.setDate(d.getDate() - d.getDay() + 1 + weekOffset * 7)
    d.setHours(0, 0, 0, 0)
    return d
  })()

  const weekDates = WEEKDAYS.map((_, i) => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    return d
  })

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any
      const { data: profile } = await sb.from('profiles').select('hospital_id').eq('id', user.id).single() as { data: { hospital_id: string } | null }
      if (!profile?.hospital_id) { setLoading(false); return }
      const from = weekDates[0]!.toISOString().split('T')[0]
      const to = weekDates[6]!.toISOString().split('T')[0]
      const { data } = await sb
        .from('staff_shifts')
        .select('id, staff_id, shift_date, start_time, end_time, department, profiles(full_name)')
        .eq('hospital_id', profile.hospital_id)
        .gte('shift_date', from)
        .lte('shift_date', to) as { data: (Shift & { profiles?: { full_name: string } })[] | null }
      setShifts((data ?? []).map(s => ({ ...s, staff_name: s.profiles?.full_name })))
      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekOffset])

  const shiftsForDate = (d: Date) => {
    const key = d.toISOString().split('T')[0]
    return shifts.filter(s => s.shift_date === key)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/hr" className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--text-muted)' }}>
          <ArrowLeft className="h-4 w-4" /> HR
        </Link>
      </div>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Duty Schedules</h1>
        <div className="flex items-center gap-2">
          {['← Prev', 'This Week', 'Next →'].map((label, idx) => (
            <button key={label} type="button"
              onClick={() => setWeekOffset(idx === 0 ? v => v - 1 : idx === 2 ? v => v + 1 : 0)}
              className="rounded-xl px-3 py-1.5 text-sm"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)', color: 'var(--text-secondary)' }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Loading schedules…</div>
      ) : (
        <div className="grid grid-cols-7 gap-2">
          {weekDates.map((d, i) => {
            const dayShifts = shiftsForDate(d)
            const isToday = d.toDateString() === new Date().toDateString()
            return (
              <div key={i} className="rounded-2xl p-3 min-h-32" style={{
                background: 'var(--bg-surface)',
                border: `1px solid ${isToday ? 'var(--brand-orange)' : 'var(--border-edge)'}`,
              }}>
                <p className="text-xs font-bold mb-2" style={{ color: isToday ? 'var(--brand-orange)' : 'var(--text-muted)' }}>
                  {WEEKDAYS[i]}<br />
                  <span style={{ color: 'var(--text-secondary)' }}>{d.getDate()}</span>
                </p>
                <div className="space-y-1">
                  {dayShifts.map(s => (
                    <div key={s.id} className="rounded-lg px-2 py-1 text-[10px]"
                      style={{ background: 'rgba(249,115,22,0.1)', color: '#F97316' }}>
                      <p className="font-semibold truncate">{s.staff_name ?? s.staff_id.slice(0, 6)}</p>
                      <p style={{ color: 'rgba(249,115,22,0.7)' }}>{s.start_time?.slice(0, 5)}–{s.end_time?.slice(0, 5)}</p>
                    </div>
                  ))}
                  {dayShifts.length === 0 && (
                    <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>No shifts</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
