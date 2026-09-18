import Link from 'next/link'
import { Palette, Globe, BookOpen, Building2 } from 'lucide-react'

export default function AdminSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Settings</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Configure your hospital portal</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {[
          { href: '/hospital/admin/settings', icon: Palette, title: 'Facility settings', desc: 'Canonical hospital profile, branding, and operations', color: '#8B5CF6' },
          { href: '/admin/settings/mfa', icon: Globe, title: 'MFA', desc: 'Multi-factor authentication for this account', color: '#3B82F6' },
          { href: '/hospital/admin', icon: Building2, title: 'Facility admin', desc: 'Staff, departments, wards, beds, and modules', color: '#F97316' },
          { href: '/admin/account', icon: BookOpen, title: 'Account', desc: 'Signed-in operator account', color: '#22C55E' },
        ].map(card => (
          <Link key={card.href} href={card.href}
            className="flex items-start gap-4 rounded-2xl p-5 transition-all hover:border-orange-500/30"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)' }}>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl shrink-0"
              style={{ background: `${card.color}20`, color: card.color }}>
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
