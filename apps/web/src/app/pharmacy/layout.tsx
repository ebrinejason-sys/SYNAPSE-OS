'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { FlaskConical, Package, ShoppingCart, AlertTriangle, Zap, BarChart2, Layers, UserRound } from 'lucide-react'
import { SynapseLogo } from '../../components/SynapseLogo'

const NAV = [
  { href: '/pharmacy', label: 'Dashboard', icon: Layers, exact: true },
  { href: '/pharmacy/interactions', label: 'Interactions', icon: Zap },
  { href: '/pharmacy/queue', label: 'Queue', icon: ShoppingCart },
  { href: '/pharmacy/dispense', label: 'Dispense', icon: FlaskConical },
  { href: '/pharmacy/inventory', label: 'Inventory', icon: Package },
  { href: '/pharmacy/expiry', label: 'Expiry', icon: AlertTriangle },
  { href: '/pharmacy/nms', label: 'NMS', icon: FlaskConical },
  { href: '/pharmacy/reports', label: 'Reports', icon: BarChart2 },
  { href: '/pharmacy/account', label: 'Account', icon: UserRound },
]

export default function PharmacyLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
      <div className="flex min-h-screen">
        {/* Sidebar — desktop only */}
        <aside
          className="hidden lg:flex lg:flex-col w-56 shrink-0 border-r py-4"
          style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
        >
          <div className="px-4 mb-6">
            <SynapseLogo size="sm" />
            <p className="text-xs mt-1 font-semibold" style={{ color: 'var(--text-muted)' }}>Pharmacy Bridge</p>
          </div>
          <nav className="flex-1 px-2 space-y-0.5">
            {NAV.map(item => {
              const active = item.exact ? pathname === item.href : pathname.startsWith(item.href) && item.href !== '/pharmacy'
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-all"
                  style={{
                    background: active ? 'rgba(249,115,22,0.1)' : 'transparent',
                    color: active ? 'var(--brand-orange)' : 'var(--text-secondary)',
                  }}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </aside>

        {/* Main */}
        <div className="flex flex-col flex-1 min-h-screen">
          {/* Mobile header */}
          <header
            className="flex items-center justify-between px-4 py-3 border-b lg:hidden sticky top-0 z-30"
            style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
          >
            <SynapseLogo size="xs" />
            <span className="text-xs font-semibold" style={{ color: 'var(--brand-orange)' }}>Pharmacy</span>
          </header>

          <main className="flex-1 overflow-y-auto pb-24 lg:pb-0">
            <div className="max-w-5xl mx-auto px-4 py-6 lg:px-8">
              {children}
            </div>
          </main>
        </div>
      </div>

      {/* Bottom tab bar — mobile only */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-30 flex overflow-x-auto border-t"
        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
      >
        {NAV.map(item => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href) && item.href !== '/pharmacy'
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex min-w-[4rem] flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium shrink-0 transition-all"
              style={{ color: active ? 'var(--brand-orange)' : 'var(--text-muted)' }}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
