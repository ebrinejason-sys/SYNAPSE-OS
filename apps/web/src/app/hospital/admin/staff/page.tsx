'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, UserRound } from 'lucide-react'

interface StaffMember {
  id: string
  full_name: string | null
  email: string | null
  role: string
  two_factor_enabled: boolean | null
}

export default function HospitalAdminStaffPage() {
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/hospital/admin/staff')
      .then((r) => r.json())
      .then((d) => setStaff(d.staff ?? []))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Staff</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{staff.length} team members</p>
        </div>
        <Link href="/hospital/admin/staff/invite" className="btn-primary flex items-center gap-2 text-sm">
          <Plus className="h-4 w-4" /> Invite staff
        </Link>
      </div>
      {loading ? <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading…</p> : (
        <div className="space-y-2">
          {staff.map((member) => (
            <div key={member.id} className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)' }}>
              <div className="flex h-9 w-9 items-center justify-center rounded-full" style={{ background: 'rgba(249,115,22,0.1)', color: 'var(--brand-orange)' }}>
                <UserRound className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{member.full_name ?? '—'}</p>
                <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{member.email}</p>
              </div>
              <span
                className="text-xs rounded-full px-2 py-0.5 font-semibold"
                style={
                  member.two_factor_enabled
                    ? { background: 'rgba(34,197,94,0.1)', color: '#22C55E' }
                    : { background: 'rgba(107,114,128,0.1)', color: '#6B7280' }
                }
              >
                {member.two_factor_enabled ? 'MFA on' : 'MFA off'}
              </span>
              <span className="text-xs rounded-full px-2 py-0.5 capitalize" style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>{member.role}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
