"use client"

import { usePharmacySession } from "@/hooks/use-pharmacy-session"
import { createClient } from "@/lib/supabase/client"
import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import { 
  LayoutDashboard,
  LogOut,
  Menu,
  X,
  User
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useState } from "react"
import { cn } from "@/lib/utils"

export default function StaffLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user } = usePharmacySession()
  const pathname = usePathname()
  const router = useRouter()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  const navigation = [
    { name: "Dashboard", href: "/staff/dashboard", icon: LayoutDashboard },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar backdrop */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed top-0 left-0 z-50 h-screen w-64 bg-gradient-to-b from-white to-gray-50 border-r shadow-xl transition-transform duration-300 ease-in-out lg:translate-x-0",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-4 border-b bg-white/80 backdrop-blur-sm">
            <Link href="/staff/dashboard" className="flex items-center space-x-2 hover:opacity-80 transition-opacity">
              <div className="w-10 h-10 bg-gradient-to-br from-green-600 to-blue-600 rounded-lg flex items-center justify-center shadow-lg">
                <span className="text-sm font-bold text-white">SP</span>
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-base">SYNAPSE Pharm</span>
                <span className="text-[10px] text-gray-500 uppercase tracking-wide">Staff Portal</span>
              </div>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden hover:bg-gray-100"
              onClick={() => setIsSidebarOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
            {navigation.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200",
                    isActive
                      ? "bg-gradient-to-r from-green-600 to-blue-600 text-white shadow-lg shadow-green-500/30 scale-105"
                      : "text-gray-700 hover:bg-gray-100 hover:scale-102 hover:shadow-md"
                  )}
                  onClick={() => setIsSidebarOpen(false)}
                >
                  <Icon className={cn("h-5 w-5", isActive && "drop-shadow-sm")} />
                  <span>{item.name}</span>
                </Link>
              )
            })}
          </nav>

          {/* User Info */}
          <div className="border-t bg-white/50 p-4 backdrop-blur-sm">
            <div className="flex items-center space-x-3 mb-3">
              <div className="w-10 h-10 bg-gradient-to-br from-green-600 to-blue-600 rounded-full flex items-center justify-center shadow-md">
                <span className="text-sm font-bold text-white">
                  {user?.fullName?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate text-gray-900">{user?.fullName ?? ""}</p>
                <p className="text-xs text-gray-500 font-medium">{user?.pharmacyRole}</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full hover:bg-red-50 hover:text-red-600 hover:border-red-300 transition-all duration-200"
              onClick={async () => {
                const supabase = createClient()
                await supabase.auth.signOut()
                router.push("/login")
              }}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex items-center h-16 px-4 bg-white/90 bg-gradient-to-r from-[#F97316]/10 to-[#E8B84B]/10 backdrop-blur-md border-b border-[#F97316]/30 shadow-sm lg:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden hover:bg-gray-100"
            onClick={() => setIsSidebarOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </Button>
          <div className="flex-1 lg:ml-0 ml-2">
            <h1 className="text-xl font-semibold text-gray-900 hidden sm:block">
              {navigation.find(item => item.href === pathname)?.name || "Dashboard"}
            </h1>
          </div>
          <div className="flex items-center space-x-2">
            <div className="hidden md:flex flex-col items-end">
              <span className="text-sm font-medium text-gray-700">{user?.fullName ?? ""}</span>
              <span className="text-xs text-gray-500">{user?.pharmacyRole}</span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-6 xl:p-8 max-w-[1920px] mx-auto">
          <div className="animate-in fade-in duration-500">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
