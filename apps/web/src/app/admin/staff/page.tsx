'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Search, UserRound } from 'lucide-react'
import { createClient } from '../../../lib/supabase/client'

interface StaffMember {
  id: string
  full_name: string | null
  email: string | null
  role: string
  verification_status: string
  specialty_confirmed: string | null
  created_at: string
}

export const dynamic = 'force-dynamic'

export default function AdminStaffPage() {
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: profile } = await (supabase as any)
        .from('profiles')
        .select('hospital_id')
        .eq('id', user.id)
        .single() as { data: { hospital_id: string } | null }
      if (!profile?.hospital_id) { setLoading(false); return }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from('profiles')
        .select('id, full_name, email, role, verification_status, specialty_confirmed, created_at')
        .eq('hospital_id', profile.hospital_id)
        .neq('role', 'patient')
        .order('created_at', { ascending: false }) as { data: StaffMember[] | null }
      setStaff(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const filtered = staff.filter(s =>
    !search ||
    (s.full_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (s.email ?? '').toLowerCase().includes(search.toLowerCase()) ||
    s.role.toLowerCase().includes(search.toLowerCase())
  )

  const ROLE_COLOR: Record<string, string> = {
    doctor: '#3B82F6', nurse: '#10B981', pharmacist: '#8B5CF6',
    admin: '#F97316', clinician: '#6366F1', lab_tech: '#EAB308',
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Staff Management</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{staff.length} team members</p>
        </div>
        <Link href="/admin/staff/invite" className="btn-primary flex items-center gap-2 text-sm">
          <Plus className="h-4 w-4" /> Invite Staff
        </Link>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--text-muted)' }} />
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, email, or role…"
          className="w-full rounded-xl py-2.5 pl-10 pr-4 text-sm outline-none"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)', color: 'var(--text-primary)' }}
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16" style={{ color: 'var(--text-muted)' }}>Loading staff…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <UserRound className="h-10 w-10 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
            {search ? 'No staff match your search.' : 'No staff yet — invite your first team member.'}
          </p>
          {!search && (
            <Link href="/admin/staff/invite" className="btn-primary inline-block text-sm">Invite Staff Member</Link>
          )}
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border-edge)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-edge)' }}>
                {['NAME', 'ROLE', 'SPECIALTY', 'STATUS', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, i) => (
                <tr
                  key={s.id}
                  style={{
                    background: i % 2 === 0 ? 'var(--bg-base)' : 'var(--bg-surface)',
                    borderBottom: '1px solid var(--border-subtle)',
                  }}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold shrink-0"
                        style={{ background: 'rgba(249,115,22,0.12)', color: 'var(--brand-orange)' }}
                      >
                        {(s.full_name ?? 'U')[0]!.toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{s.full_name ?? 'Unknown'}</p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{s.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="rounded-full px-2 py-0.5 text-xs font-semibold capitalize"
                      style={{
                        background: `${ROLE_COLOR[s.role] ?? '#6B7280'}18`,
                        color: ROLE_COLOR[s.role] ?? '#6B7280',
                      }}
                    >
                      {s.role.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {s.specialty_confirmed ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="rounded-full px-2 py-0.5 text-xs font-semibold"
                      style={{
                        background: s.verification_status === 'verified' ? 'rgba(34,197,94,0.1)' : 'rgba(234,179,8,0.1)',
                        color: s.verification_status === 'verified' ? '#22C55E' : '#EAB308',
                      }}
                    >
                      {s.verification_status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      className="text-xs rounded-lg px-3 py-1.5 transition-all"
                      style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border-edge)' }}
                    >
                      View
                    </button>
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
