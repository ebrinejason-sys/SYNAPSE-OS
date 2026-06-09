"use client"

import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import {
  LayoutDashboard, Users, Package, ShoppingCart, DollarSign,
  Settings, LogOut, Menu, X, UserCheck, ClipboardList,
  MessageSquare, Activity, Bell, Truck, FileText, BarChart3,
  RotateCcw, Wifi, WifiOff, CalendarClock, WalletCards, BrainCircuit,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { NotificationBell } from "@/components/ui/notification-bell"
import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { usePharmacySession } from "@/hooks/use-pharmacy-session"
import { createClient } from "@/lib/supabase/client"

export const dynamic = "force-dynamic"

const navigation = [
  { name: "Dashboard",       href: "/portal/dashboard",       icon: LayoutDashboard },
  { name: "Users",           href: "/portal/users",           icon: Users,       permission: "MANAGE_USERS" },
  { name: "Inventory",       href: "/portal/inventory",       icon: Package,     permission: "MANAGE_INVENTORY" },
  { name: "Suppliers",       href: "/portal/suppliers",       icon: Truck,       permission: "MANAGE_INVENTORY" },
  { name: "Purchase Orders", href: "/portal/purchase-orders", icon: FileText,    permission: "MANAGE_INVENTORY" },
  { name: "POS",             href: "/portal/pos",             icon: ShoppingCart,permission: "MANAGE_POS" },
  { name: "Customers",       href: "/portal/customers",       icon: UserCheck,   permission: "MANAGE_POS" },
  { name: "Refills",         href: "/portal/refills",         icon: CalendarClock,permission: "MANAGE_POS" },
  { name: "Credit Ledger",   href: "/portal/credit-ledger",   icon: WalletCards, permission: "VIEW_TRANSACTIONS" },
  { name: "Import Assistant",href: "/portal/import-assistant",icon: BrainCircuit,permission: "MANAGE_INVENTORY" },
  { name: "Orders",          href: "/portal/orders",          icon: ClipboardList,permission: "MANAGE_POS" },
  { name: "Transactions",    href: "/portal/transactions",    icon: DollarSign,  permission: "VIEW_TRANSACTIONS" },
  { name: "Reports",         href: "/portal/reports",         icon: BarChart3,   permission: "VIEW_REPORTS" },
  { name: "Refunds",         href: "/portal/refunds",         icon: RotateCcw,   permission: "MANAGE_TRANSACTIONS" },
  { name: "Inquiries",       href: "/portal/inquiries",       icon: MessageSquare, adminOnly: true },
  { name: "Activity Log",    href: "/portal/activity-log",    icon: Activity,    adminOnly: true },
  { name: "Settings",        href: "/portal/settings",        icon: Settings,    permission: "MANAGE_SETTINGS" },
]

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = usePharmacySession()
  const pathname = usePathname()
  const router = useRouter()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isOnline, setIsOnline] = useState(true)

  useEffect(() => {
    setIsOnline(navigator.onLine)
    const onOnline = () => setIsOnline(true)
    const onOffline = () => setIsOnline(false)
    window.addEventListener("online", onOnline)
    window.addEventListener("offline", onOffline)
    return () => { window.removeEventListener("online", onOnline); window.removeEventListener("offline", onOffline) }
  }, [])

  const hasPermission = (permission?: string, adminOnly?: boolean) => {
    if (!user) return false
    const isAdminRole = user.pharmacyRole === "pharmacy_admin" || user.pharmacyRole === "pharmacy_ceo" || user.isAdmin
    if (adminOnly) return isAdminRole
    if (!permission) return true
    if (isAdminRole) return true
    return user.permissions.includes(permission)
  }

  const filteredNav = navigation.filter(item => hasPermission(item.permission, item.adminOnly))

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    )
  }

  const displayName = user?.fullName ?? user?.email ?? "User"
  const roleLabel = user?.pharmacyRole?.replace("pharmacy_", "").toUpperCase() ?? "STAFF"

  return (
    <div className="min-h-screen bg-background">
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed top-0 left-0 z-50 h-screen w-64 border-r border-border bg-card flex flex-col transition-transform duration-300 lg:translate-x-0",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-border">
          <Link href="/portal/dashboard" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#F97316] to-[#E8B84B] flex items-center justify-center shadow">
              <span className="text-white font-black text-sm">S</span>
            </div>
            <div className="flex flex-col leading-tight">
              <span className="font-bold text-sm text-foreground">SYNAPSE Pharm</span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Admin Portal</span>
            </div>
          </Link>
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setIsSidebarOpen(false)}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {filteredNav.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            return (
              <Link
                key={item.name}
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
        </nav>

        {/* User footer */}
        <div className="border-t border-border p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
              <span className="text-sm font-bold text-primary">
                {displayName.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate text-foreground">{displayName}</p>
              <p className="text-xs text-muted-foreground">{roleLabel}</p>
            </div>
          </div>
          <button onClick={handleSignOut} className="btn-ghost w-full text-sm text-muted-foreground hover:text-destructive">
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 lg:px-6 bg-card/80 backdrop-blur-md border-b border-border">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setIsSidebarOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>

          <h1 className="text-base font-semibold text-foreground hidden lg:block">
            {filteredNav.find(item => item.href === pathname)?.name ?? "Dashboard"}
          </h1>

          <div className="flex items-center gap-3 ml-auto">
            <div className={cn(
              "hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border",
              isOnline
                ? "bg-green-500/10 text-green-400 border-green-500/20"
                : "bg-amber-500/10 text-amber-400 border-amber-500/20"
            )}>
              {isOnline ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
              <span>{isOnline ? "Online" : "Offline"}</span>
            </div>
            <NotificationBell />
            <div className="hidden md:flex flex-col items-end">
              <span className="text-sm font-medium text-foreground">{displayName}</span>
              <span className="text-xs text-muted-foreground">{roleLabel}</span>
            </div>
          </div>
        </header>

        <main className="p-4 lg:p-6 xl:p-8 max-w-[1920px] mx-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
