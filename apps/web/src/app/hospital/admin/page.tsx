'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { BedDouble, Building2, FileText, Settings, ToggleLeft, Users } from 'lucide-react'

const LINKS = [
  { href: '/hospital/admin/settings', label: 'Facility settings', icon: Settings },
  { href: '/hospital/admin/departments', label: 'Departments', icon: Building2 },
  { href: '/hospital/admin/beds', label: 'Wards & beds', icon: BedDouble },
  { href: '/hospital/admin/staff', label: 'Staff roster', icon: Users },
  { href: '/hospital/admin/modules', label: 'Module manager', icon: ToggleLeft },
  { href: '/hospital/admin/audit', label: 'Audit log', icon: FileText },
]

export default function HospitalAdminDashboardPage() {
  const [stats, setStats] = useState({ departments: 0, beds: 0, staff: 0, modules: 0 })

  useEffect(() => {
    async function load() {
      const [depts, beds, staff, modules] = await Promise.all([
        fetch('/api/hospital/admin/departments').then((r) => r.json()).catch(() => ({ departments: [] })),
        fetch('/api/hospital/admin/beds').then((r) => r.json()).catch(() => ({ beds: [] })),
        fetch('/api/hospital/admin/staff').then((r) => r.json()).catch(() => ({ staff: [] })),
        fetch('/api/hospital/admin/modules').then((r) => r.json()).catch(() => ({ modules: [] })),
      ])
      setStats({
        departments: depts.departments?.length ?? 0,
        beds: beds.beds?.length ?? 0,
        staff: staff.staff?.length ?? 0,
        modules: (modules.modules ?? []).filter((m: { is_active: boolean }) => m.is_active).length,
      })
    }
    load()
  }, [])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Hospital Admin</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Configure facility settings, departments, beds, staff, modules, and services.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Departments', value: stats.departments },
          { label: 'Beds', value: stats.beds },
          { label: 'Staff', value: stats.staff },
          { label: 'Active modules', value: stats.modules },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-2xl p-5"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)' }}
          >
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
              {s.label}
            </p>
            <p className="mt-2 text-3xl font-bold" style={{ color: 'var(--brand-orange)' }}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {LINKS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 rounded-2xl p-4 transition-all hover:opacity-90"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)' }}
          >
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl"
              style={{ background: 'rgba(249,115,22,0.1)', color: 'var(--brand-orange)' }}
            >
              <Icon className="h-5 w-5" />
            </div>
            <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{label}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
