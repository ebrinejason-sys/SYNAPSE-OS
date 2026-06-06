'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Activity, BedDouble, Building2, Calculator, ClipboardList,
  FileText, LayoutDashboard, Package, Settings, ShieldCheck,
  Stethoscope, Users, Wallet,
} from 'lucide-react'
import { createClient } from '../../lib/supabase/client'
import { SynapseLogo } from '../../components/SynapseLogo'

const NAV = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/admin/staff', label: 'Staff', icon: Users },
  { href: '/admin/departments', label: 'Departments', icon: Building2 },
  { href: '/admin/beds', label: 'Beds', icon: BedDouble },
  { href: '/admin/hr', label: 'HR', icon: Calculator },
  { href: '/admin/insurance', label: 'Insurance', icon: ShieldCheck },
  { href: '/admin/finance', label: 'Finance', icon: Wallet },
  { href: '/admin/supply', label: 'Supply', icon: Package },
  { href: '/admin/lab', label: 'Lab', icon: Activity },
  { href: '/admin/audit', label: 'Audit', icon: FileText },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[260px_1fr]">

        {/* Sidebar — desktop only */}
        <aside
          className="border-r px-3 py-5 hidden lg:flex flex-col"
          style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-surface)' }}
        >
          <div className="px-2 mb-6">
            <SynapseLogo size="sm" />
            <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>Hospital Admin Panel</p>
          </div>
          <nav className="flex-1 space-y-0.5">
            {NAV.map(({ href, label, icon: Icon, exact }) => {
              const active = exact ? pathname === href : pathname.startsWith(href)
              return (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-all"
                  style={{
                    background: active ? 'rgba(249,115,22,0.1)' : 'transparent',
                    color: active ? 'var(--brand-orange)' : 'var(--text-secondary)',
                    fontWeight: active ? 600 : 400,
                  }}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </Link>
              )
            })}
          </nav>
          <div className="pt-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
            <button
              type="button"
              onClick={handleSignOut}
              className="w-full rounded-xl px-3 py-2 text-sm text-left transition-all"
              style={{ color: 'var(--text-muted)' }}
            >
              Sign out
            </button>
          </div>
        </aside>

        {/* Main */}
        <section className="flex flex-col min-h-screen">
          {/* Mobile header */}
          <header
            className="flex items-center justify-between px-4 py-3 border-b lg:hidden sticky top-0 z-30"
            style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-surface)' }}
          >
            <SynapseLogo size="xs" />
            <div className="flex items-center gap-2">
              <Stethoscope className="h-4 w-4" style={{ color: 'var(--brand-orange)' }} />
              <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Admin</span>
            </div>
          </header>

          <main className="flex-1 p-4 pb-24 lg:pb-6 lg:p-6" style={{ background: 'var(--bg-base)' }}>
            {children}
          </main>
        </section>
      </div>

      {/* Bottom tab bar — mobile only */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-30 flex overflow-x-auto border-t"
        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
      >
        {NAV.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className="flex min-w-[4rem] flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium shrink-0 transition-all"
              style={{ color: active ? 'var(--brand-orange)' : 'var(--text-muted)' }}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
