# Phase 2: Unified Mobile-Responsive Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the pharmacy portal sidebar with grouped nav sections and a mobile bottom tab bar, and add a matching sidebar navigation to the web app's main layout.

**Architecture:** Pharmacy portal already has a working sidebar — enhance it with section headers and a 5-item mobile bottom tab bar. Web app root layout gets a new sidebar matching the pharmacy design language. Both use the same Tailwind tokens (primary = orange, active border-l-2, muted hover states).

**Tech Stack:** Next.js 15, Tailwind CSS, Lucide React

---

## File Map

**Modify:**
- `apps/pharmacy/app/portal/layout.tsx` — add nav section groups + mobile bottom tabs
- `apps/web/src/app/layout.tsx` or web app root layout — add sidebar nav for the clinical app

**Create:**
- `apps/web/src/components/AppSidebar.tsx` — new sidebar component for web app

---

## Task 1: Pharmacy portal — grouped nav sections + mobile bottom tabs

**File:** `apps/pharmacy/app/portal/layout.tsx`

- [ ] **Step 1: Replace the navigation array with grouped sections**

In `apps/pharmacy/app/portal/layout.tsx`, replace the `navigation` array with a grouped structure:

```typescript
const NAV_GROUPS = [
  {
    label: 'Main',
    items: [
      { name: 'Dashboard',     href: '/portal/dashboard',     icon: LayoutDashboard },
    ],
  },
  {
    label: 'Inventory',
    items: [
      { name: 'Inventory',       href: '/portal/inventory',       icon: Package,      permission: 'MANAGE_INVENTORY' },
      { name: 'Suppliers',       href: '/portal/suppliers',       icon: Truck,        permission: 'MANAGE_INVENTORY' },
      { name: 'Purchase Orders', href: '/portal/purchase-orders', icon: FileText,     permission: 'MANAGE_INVENTORY' },
      { name: 'Import Assistant',href: '/portal/import-assistant',icon: BrainCircuit, permission: 'MANAGE_INVENTORY' },
    ],
  },
  {
    label: 'Sales',
    items: [
      { name: 'POS',        href: '/portal/pos',       icon: ShoppingCart,  permission: 'MANAGE_POS' },
      { name: 'Orders',     href: '/portal/orders',    icon: ClipboardList, permission: 'MANAGE_POS' },
      { name: 'Customers',  href: '/portal/customers', icon: UserCheck,     permission: 'MANAGE_POS' },
      { name: 'Refills',    href: '/portal/refills',   icon: CalendarClock, permission: 'MANAGE_POS' },
    ],
  },
  {
    label: 'Finance',
    items: [
      { name: 'Transactions',  href: '/portal/transactions',  icon: DollarSign,  permission: 'VIEW_TRANSACTIONS' },
      { name: 'Credit Ledger', href: '/portal/credit-ledger', icon: WalletCards, permission: 'VIEW_TRANSACTIONS' },
      { name: 'Refunds',       href: '/portal/refunds',       icon: RotateCcw,   permission: 'MANAGE_TRANSACTIONS' },
      { name: 'Reports',       href: '/portal/reports',       icon: BarChart3,   permission: 'VIEW_REPORTS' },
    ],
  },
  {
    label: 'Admin',
    items: [
      { name: 'Users',       href: '/portal/users',        icon: Users,        permission: 'MANAGE_USERS' },
      { name: 'Network',     href: '/portal/network',      icon: Wifi,         permission: 'MANAGE_SETTINGS' },
      { name: 'Inquiries',   href: '/portal/inquiries',    icon: MessageSquare, adminOnly: true },
      { name: 'Activity Log',href: '/portal/activity-log', icon: Activity,     adminOnly: true },
      { name: 'Settings',    href: '/portal/settings',     icon: Settings,     permission: 'MANAGE_SETTINGS' },
    ],
  },
]

// Bottom tab items (mobile only — 5 most-used)
const BOTTOM_TABS = [
  { name: 'Dashboard', href: '/portal/dashboard',  icon: LayoutDashboard },
  { name: 'Inventory', href: '/portal/inventory',  icon: Package },
  { name: 'POS',       href: '/portal/pos',        icon: ShoppingCart },
  { name: 'Orders',    href: '/portal/orders',     icon: ClipboardList },
  { name: 'More',      href: '#',                  icon: Menu, isMore: true },
]
```

- [ ] **Step 2: Update the sidebar nav rendering to use groups**

In the `<nav>` section of the sidebar, replace the `filteredNav.map(...)` with:

```tsx
<nav className="flex-1 px-3 py-4 overflow-y-auto space-y-4">
  {NAV_GROUPS.map((group) => {
    const visibleItems = group.items.filter(item =>
      hasPermission(item.permission, item.adminOnly)
    )
    if (visibleItems.length === 0) return null
    return (
      <div key={group.label}>
        <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          {group.label}
        </p>
        <div className="space-y-0.5">
          {visibleItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                  isActive
                    ? "bg-primary/10 text-primary border-l-2 border-primary"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.name}</span>
              </Link>
            )
          })}
        </div>
      </div>
    )
  })}
</nav>
```

- [ ] **Step 3: Add mobile bottom tab bar**

At the end of the `<div className="lg:pl-64">` section (after `<main>`), add a mobile bottom tab bar:

```tsx
{/* Mobile bottom tab bar */}
<nav className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-card/95 backdrop-blur-md border-t border-border">
  <div className="flex items-center justify-around px-2 py-1 safe-area-inset-bottom">
    {BOTTOM_TABS.map((tab) => {
      const Icon = tab.icon
      const isActive = !tab.isMore && pathname === tab.href
      if (tab.isMore) {
        return (
          <button
            key="more"
            onClick={() => setIsSidebarOpen(true)}
            className="flex flex-col items-center gap-1 px-3 py-2 text-muted-foreground"
          >
            <Icon className="h-5 w-5" />
            <span className="text-[10px]">More</span>
          </button>
        )
      }
      return (
        <Link
          key={tab.href}
          href={tab.href}
          className={cn(
            "flex flex-col items-center gap-1 px-3 py-2 transition-colors",
            isActive ? "text-primary" : "text-muted-foreground"
          )}
        >
          <Icon className="h-5 w-5" />
          <span className="text-[10px]">{tab.name}</span>
        </Link>
      )
    })}
  </div>
</nav>
```

- [ ] **Step 4: Add bottom padding to main content on mobile (so content isn't hidden behind tab bar)**

Modify the `<main>` element to add `pb-20 lg:pb-0`:

```tsx
<main className="p-4 pb-20 lg:p-6 xl:p-8 lg:pb-8 max-w-[1920px] mx-auto">
  {children}
</main>
```

- [ ] **Step 5: Verify build**

```powershell
cd C:\Users\ebrin\SYNAPSE-OS\apps\pharmacy; npm run build 2>&1 | Select-Object -Last 8
```

- [ ] **Step 6: Commit**

```bash
git add apps/pharmacy/app/portal/layout.tsx
git commit -m "feat(pharmacy): grouped nav sections + mobile bottom tab bar"
```

---

## Task 2: Web app — identify the right layout to add sidebar nav

**Files to read:** `apps/web/src/app/layout.tsx`, `apps/web/src/app/os/layout.tsx` (if exists), `apps/web/src/app/doctor/layout.tsx` (if exists)

- [ ] **Step 1: Find where the clinical app shell renders**

```powershell
Get-ChildItem -Recurse -Path "C:\Users\ebrin\SYNAPSE-OS\apps\web\src\app" -Filter "layout.tsx" | Select-Object FullName
```

Identify the layout that wraps `/os/`, `/doctor/`, `/nurse/`, `/lab/` etc. This is where the sidebar should live.

- [ ] **Step 2: Check if a clinical layout already exists**

Read `apps/web/src/app/os/layout.tsx` or `apps/web/src/app/(app)/layout.tsx` if they exist.

If a layout already exists for the clinical routes, skip to Task 3 (enhance it). If not, create one.

---

## Task 3: Create AppSidebar component for web app

**File:** `apps/web/src/components/AppSidebar.tsx`

- [ ] **Step 1: Create the AppSidebar component**

Create `apps/web/src/components/AppSidebar.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  LayoutDashboard, Stethoscope, UserRound, FlaskConical, Pill,
  Users, ClipboardList, BarChart3, Settings, Menu, X, ChevronDown,
  HeartPulse, FileText, Activity,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_GROUPS = [
  {
    label: 'Clinical',
    items: [
      { name: 'Dashboard',  href: '/os/dashboard',   icon: LayoutDashboard },
      { name: 'Doctor',     href: '/doctor/queue',   icon: Stethoscope },
      { name: 'Nurse',      href: '/nurse/queue',    icon: HeartPulse },
      { name: 'Patient',    href: '/patient/search', icon: UserRound },
    ],
  },
  {
    label: 'Departments',
    items: [
      { name: 'Laboratory', href: '/lab/orders',     icon: FlaskConical },
      { name: 'Pharmacy',   href: '/pharmacy/queue', icon: Pill },
      { name: 'Encounters', href: '/encounter/new',  icon: ClipboardList },
    ],
  },
  {
    label: 'Admin',
    items: [
      { name: 'Staff',    href: '/admin/settings',  icon: Users },
      { name: 'Reports',  href: '/admin/lab',       icon: BarChart3 },
      { name: 'Activity', href: '/activity',        icon: Activity },
      { name: 'Settings', href: '/admin/settings',  icon: Settings },
    ],
  },
]

const BOTTOM_TABS = [
  { name: 'Dashboard', href: '/os/dashboard',   icon: LayoutDashboard },
  { name: 'Doctor',    href: '/doctor/queue',   icon: Stethoscope },
  { name: 'Patients',  href: '/patient/search', icon: UserRound },
  { name: 'Lab',       href: '/lab/orders',     icon: FlaskConical },
  { name: 'More',      href: '#',               icon: Menu, isMore: true },
]

export function AppSidebar({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  return (
    <div className="min-h-screen bg-background">
      {open && (
        <button
          type="button"
          aria-label="Close sidebar"
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed top-0 left-0 z-50 h-screen w-64 border-r border-border bg-card flex flex-col transition-transform duration-300 lg:translate-x-0",
        open ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-border">
          <Link href="/os/dashboard" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#F97316] to-[#E8B84B] flex items-center justify-center shadow">
              <span className="text-white font-black text-sm">S</span>
            </div>
            <div className="flex flex-col leading-tight">
              <span className="font-bold text-sm text-foreground">SYNAPSE OS</span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Clinical</span>
            </div>
          </Link>
          <button
            type="button"
            className="lg:hidden text-muted-foreground hover:text-foreground p-1"
            onClick={() => setOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-4">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon
                  const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                        isActive
                          ? "bg-primary/10 text-primary border-l-2 border-primary"
                          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span>{item.name}</span>
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 lg:px-6 bg-card/80 backdrop-blur-md border-b border-border">
          <button
            type="button"
            className="lg:hidden text-muted-foreground hover:text-foreground p-2"
            onClick={() => setOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1" />
        </header>

        <main className="p-4 pb-20 lg:p-6 lg:pb-6 max-w-[1920px] mx-auto">
          {children}
        </main>

        {/* Mobile bottom tabs */}
        <nav className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-card/95 backdrop-blur-md border-t border-border">
          <div className="flex items-center justify-around px-2 py-1">
            {BOTTOM_TABS.map((tab) => {
              const Icon = tab.icon
              const isActive = !tab.isMore && (pathname === tab.href || pathname.startsWith(tab.href + '/'))
              if (tab.isMore) {
                return (
                  <button
                    key="more"
                    onClick={() => setOpen(true)}
                    className="flex flex-col items-center gap-1 px-3 py-2 text-muted-foreground"
                  >
                    <Icon className="h-5 w-5" />
                    <span className="text-[10px]">More</span>
                  </button>
                )
              }
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={cn(
                    "flex flex-col items-center gap-1 px-3 py-2 transition-colors",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-[10px]">{tab.name}</span>
                </Link>
              )
            })}
          </div>
        </nav>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

```powershell
cd C:\Users\ebrin\SYNAPSE-OS\apps\web; npm run build 2>&1 | Select-Object -Last 8
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/AppSidebar.tsx
git commit -m "feat(web): create AppSidebar component with grouped nav + mobile bottom tabs"
```

---

## Task 4: Wire AppSidebar into the web app clinical layout

- [ ] **Step 1: Find or create the clinical layout**

Check if `apps/web/src/app/(app)/layout.tsx` or `apps/web/src/app/os/layout.tsx` exists.
If neither exists, find the layout that wraps `/doctor/`, `/nurse/`, `/lab/` routes.

Read the file that was found.

- [ ] **Step 2: Wrap children with AppSidebar**

In the found layout file, import and use `AppSidebar`:

```tsx
import { AppSidebar } from '@/components/AppSidebar'

export default function ClinicalLayout({ children }: { children: React.ReactNode }) {
  return <AppSidebar>{children}</AppSidebar>
}
```

If no shared layout exists, create `apps/web/src/app/(clinical)/layout.tsx` and move the clinical routes into that route group. This is a larger refactor — if routes are already individually wrapped, skip this step and note it as a future cleanup.

- [ ] **Step 3: Verify build**

```powershell
cd C:\Users\ebrin\SYNAPSE-OS\apps\web; npm run build 2>&1 | Select-Object -Last 8
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/
git commit -m "feat(web): wire AppSidebar into clinical app layout"
```

---

## Self-Review

**Spec coverage:**
- ✅ Pharmacy portal: grouped nav sections with labels (Task 1)
- ✅ Pharmacy portal: mobile bottom tab bar — Dashboard, Inventory, POS, Orders, More (Task 1)
- ✅ Web app: AppSidebar component with grouped sections + bottom tabs (Task 3)
- ✅ Both apps: same active state tokens (border-l-2 border-primary, bg-primary/10) (Tasks 1, 3)
- ✅ Both apps: mobile hamburger → slide-in sidebar (Tasks 1, 3)

**Notes:**
- Web app clinical layout wiring (Task 4) depends on discovering existing layout structure. If no shared layout exists, the AppSidebar is created but not wired — flag this and create a follow-up task.
- The bottom tab "More" button opens the full sidebar on mobile.
