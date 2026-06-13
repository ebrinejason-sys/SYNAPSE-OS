'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Activity, BedDouble, Building2, ShieldCheck, Users, Wallet } from 'lucide-react'
import { createClient } from '../../lib/supabase/client'
import { getCurrentUser } from '@/lib/auth/getCurrentUser'

interface Stats {
  staff: number
  departments: number
  beds: number
  pendingClaims: number
}

export const dynamic = 'force-dynamic'

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats>({ staff: 0, departments: 0, beds: 0, pendingClaims: 0 })
  const [hospitalName, setHospitalName] = useState('Your Hospital')

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const user = await getCurrentUser()
      if (!user) return

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: profile } = await (supabase as any)
        .from('profiles')
        .select('hospital_id')
        .eq('id', user.id)
        .single() as { data: { hospital_id: string } | null }

      if (!profile?.hospital_id) return
      const hid = profile.hospital_id as string

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: hospital } = await (supabase as any)
        .from('hospitals')
        .select('name')
        .eq('id', hid)
        .single() as { data: { name: string } | null }
      if (hospital?.name) setHospitalName(hospital.name)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any
      const [staffRes, deptRes, bedRes, claimRes] = await Promise.all([
        sb.from('profiles').select('id', { count: 'exact', head: true }).eq('hospital_id', hid).neq('role', 'patient'),
        sb.from('departments').select('id', { count: 'exact', head: true }).eq('hospital_id', hid),
        sb.from('hospital_beds').select('id', { count: 'exact', head: true }).eq('hospital_id', hid),
        sb.from('insurance_claims').select('id', { count: 'exact', head: true }).eq('hospital_id', hid).eq('status', 'pending'),
      ]) as [{ count: number | null }, { count: number | null }, { count: number | null }, { count: number | null }]

      setStats({
        staff: staffRes.count ?? 0,
        departments: deptRes.count ?? 0,
        beds: bedRes.count ?? 0,
        pendingClaims: claimRes.count ?? 0,
      })
    }
    load()
  }, [])

  const CARDS = [
    { label: 'Staff Members', value: stats.staff, icon: Users, href: '/admin/staff', color: '#3B82F6' },
    { label: 'Departments', value: stats.departments, icon: Building2, href: '/admin/departments', color: '#8B5CF6' },
    { label: 'Total Beds', value: stats.beds, icon: BedDouble, href: '/admin/beds', color: '#10B981' },
    { label: 'Pending Claims', value: stats.pendingClaims, icon: ShieldCheck, href: '/admin/insurance/claims', color: '#F97316' },
  ]

  const QUICK_LINKS = [
    { href: '/admin/staff/invite', label: 'Invite Staff', icon: Users },
    { href: '/admin/departments', label: 'Manage Departments', icon: Building2 },
    { href: '/admin/insurance/claims', label: 'Review Claims', icon: ShieldCheck },
    { href: '/admin/hr/payroll', label: 'Run Payroll', icon: Wallet },
    { href: '/admin/finance', label: 'Finance Overview', icon: Activity },
    { href: '/admin/settings', label: 'Hospital Settings', icon: Activity },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{hospitalName}</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Hospital Admin Dashboard</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {CARDS.map(({ label, value, icon: Icon, href, color }) => (
          <Link
            key={href}
            href={href}
            className="rounded-2xl p-5 transition-all hover:scale-[1.02]"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)' }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: `${color}18`, color }}>
                <Icon className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{value.toLocaleString()}</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{label}</p>
          </Link>
        ))}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-muted)' }}>QUICK ACTIONS</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {QUICK_LINKS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition-all hover:border-orange-500/30"
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-edge)',
                color: 'var(--text-secondary)',
              }}
            >
              <Icon className="h-4 w-4 shrink-0" style={{ color: 'var(--brand-orange)' }} />
              {label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
