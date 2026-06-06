import Link from 'next/link'
import { Users, DollarSign, Calendar, Clock } from 'lucide-react'

export default function AdminHRPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Human Resources</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Staff management, payroll, scheduling and attendance</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {[
          { href: '/admin/staff', icon: Users, title: 'Staff Directory', desc: 'View and manage all staff accounts', color: '#3B82F6' },
          { href: '/admin/hr/payroll', icon: DollarSign, title: 'Payroll', desc: 'Run payroll, set salaries and allowances', color: '#22C55E' },
          { href: '/admin/hr/schedules', icon: Calendar, title: 'Schedules', desc: 'Shift planning and duty rosters', color: '#8B5CF6' },
          { href: '/admin/hr/attendance', icon: Clock, title: 'Attendance', desc: 'Track clock-in/out and absences', color: '#F97316' },
        ].map(card => (
          <Link
            key={card.href}
            href={card.href}
            className="flex items-start gap-4 rounded-2xl p-5 transition-all hover:border-orange-500/30"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)' }}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl shrink-0" style={{ background: `${card.color}20`, color: card.color }}>
              <card.icon className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{card.title}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{card.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
