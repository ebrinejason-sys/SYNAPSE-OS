"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { resetDemoPlayground, exportDemoPlayground, importDemoPlayground, getFacilities, getUsers } from "../../lib/demo/browser-repository"
import type { DemoFacility, DemoUser } from "../../lib/demo/entities"
import { DEMO_ROUTES } from "../../lib/demo/paths"

const ROLE_COLORS: Record<string, string> = {
  reception: "#3B82F6",
  nurse: "#10B981",
  doctor: "#F59E0B",
  lab_technician: "#8B5CF6",
  lab_scientist: "#8B5CF6",
  pharmacist: "#EC4899",
  cashier: "#6B7280",
  admin: "#6B7280",
}

const FACILITY_ICONS: Record<string, string> = {
  hospital: "🏥",
  clinic: "🏥",
  laboratory: "🧪",
  pharmacy: "💊",
}

interface DemoSession {
  facilityId: string
  facilityName: string
  role: string
  userName: string
  userId: string
  online: boolean
}

interface DemoShellProps {
  title: string
  children: React.ReactNode
  currentRole?: string
  requiresRole?: string[]
}

export function DemoShell({ title, children, currentRole, requiresRole }: DemoShellProps) {
  const [session, setSession] = useState<DemoSession | null>(null)
  const [showControls, setShowControls] = useState(false)
  const [facilities, setFacilities] = useState<DemoFacility[]>([])
  const [users, setUsers] = useState<DemoUser[]>([])
  const [pendingSyncCount, setPendingSyncCount] = useState(0)

  useEffect(() => {
    loadSession()
    loadData()
  }, [])

  async function loadSession() {
    const storedFacility = sessionStorage.getItem("synapse_demo_facility") || "demo-hospital"
    const storedRole = sessionStorage.getItem("synapse_demo_role") || "doctor"
    const storedOnline = sessionStorage.getItem("synapse_demo_online") !== "false"
    
    const facilities = await getFacilities()
    const users = await getUsers()
    const facility = facilities.find((f) => f.id === storedFacility)
    const user = users.find((u) => u.role === storedRole)

    if (facility && user) {
      setSession({
        facilityId: facility.id,
        facilityName: facility.name,
        role: user.role,
        userName: user.name,
        userId: user.id,
        online: storedOnline
      })
    }
  }

  async function loadData() {
    const [facs, usrs] = await Promise.all([getFacilities(), getUsers()])
    setFacilities(facs)
    setUsers(usrs)
  }

  async function switchFacility(facilityId: string) {
    sessionStorage.setItem("synapse_demo_facility", facilityId)
    await loadSession()
  }

  async function switchRole(role: string) {
    sessionStorage.setItem("synapse_demo_role", role)
    await loadSession()
  }

  async function toggleOnline() {
    const newOnline = !session?.online
    sessionStorage.setItem("synapse_demo_online", String(newOnline))
    setSession(prev => prev ? { ...prev, online: newOnline } : null)
  }

  async function handleReset() {
    if (!confirm("Reset all demo data? This will clear the playground and start fresh.")) return
    await resetDemoPlayground()
    window.location.reload()
  }

  async function handleExport() {
    const data = await exportDemoPlayground()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `synapse-demo-${new Date().toISOString()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleImport() {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = ".json"
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      const text = await file.text()
      const data = JSON.parse(text)
      await importDemoPlayground(data)
      window.location.reload()
    }
    input.click()
  }

  const roleColor = ROLE_COLORS[session?.role ?? ""] ?? "#6B7280"
  const currentFacility = facilities.find((f) => f.id === session?.facilityId)

  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* Top Bar */}
      <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container mx-auto px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold px-2 py-1 rounded bg-orange-500/10 text-orange-500 border border-orange-500/20">
                SYNTHETIC PLAYGROUND
              </span>
              <div className="hidden sm:flex items-center gap-2 text-sm">
                <span>{FACILITY_ICONS[currentFacility?.type ?? ""] ?? "🏥"}</span>
                <span className="font-semibold">{session?.facilityName || "Loading..."}</span>
                <span className="text-muted-foreground">·</span>
                <span style={{ color: roleColor }}>{session?.userName || "..."}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Online/Offline Toggle */}
              <button
                onClick={toggleOnline}
                className="px-3 py-1 rounded text-xs font-semibold transition-colors"
                style={{
                  background: session?.online ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                  color: session?.online ? "#22C55E" : "#EF4444",
                  border: `1px solid ${session?.online ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`
                }}
              >
                {session?.online ? "🟢 ONLINE" : "🔴 OFFLINE"}
              </button>

              {/* Pending Sync */}
              {!session?.online && pendingSyncCount > 0 && (
                <span className="px-2 py-1 rounded text-xs font-semibold bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">
                  {pendingSyncCount} pending
                </span>
              )}

              {/* Controls Toggle */}
              <button
                onClick={() => setShowControls(!showControls)}
                className="px-3 py-1 rounded text-xs font-semibold bg-secondary hover:bg-secondary/80 transition-colors"
              >
                {showControls ? "Hide" : "Show"} Controls
              </button>
            </div>
          </div>

          {/* Control Panel */}
          {showControls && (
            <div className="mt-3 pt-3 border-t space-y-3">
              {/* Facility Switcher */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground">Facility:</span>
                {facilities.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => switchFacility(f.id)}
                    className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                      session?.facilityId === f.id
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary hover:bg-secondary/80"
                    }`}
                  >
                    {FACILITY_ICONS[f.type] ?? "🏢"} {f.name}
                  </button>
                ))}
              </div>

              {/* Role Switcher */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground">Role:</span>
                {Array.from(new Set(users.map((u) => u.role))).map((role) => {
                  const user = users.find((u) => u.role === role)
                  return (
                    <button
                      key={role}
                      onClick={() => switchRole(role)}
                      className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                        session?.role === role
                          ? "text-white"
                          : "bg-secondary hover:bg-secondary/80"
                      }`}
                      style={session?.role === role ? {
                        backgroundColor: ROLE_COLORS[role] ?? "#6B7280",
                      } : {}}
                    >
                      {user?.name}
                    </button>
                  )
                })}
              </div>

              {/* Actions */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground">Actions:</span>
                <button
                  onClick={handleExport}
                  className="px-3 py-1 rounded text-xs font-medium bg-secondary hover:bg-secondary/80 transition-colors"
                >
                  💾 Export
                </button>
                <button
                  onClick={handleImport}
                  className="px-3 py-1 rounded text-xs font-medium bg-secondary hover:bg-secondary/80 transition-colors"
                >
                  📂 Import
                </button>
                <button
                  onClick={handleReset}
                  className="px-3 py-1 rounded text-xs font-medium bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                >
                  🔄 Reset
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Page Header */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-3xl font-bold">{title}</h1>
            <nav className="flex flex-wrap gap-3 text-sm">
              <Link href={DEMO_ROUTES.home} className="hover:underline">Home</Link>
              <Link href={DEMO_ROUTES.workspace} className="hover:underline">Workspace</Link>
              <Link href={DEMO_ROUTES.timeline} className="hover:underline">Timeline</Link>
              <Link href={DEMO_ROUTES.network} className="hover:underline">Network</Link>
              <Link href={DEMO_ROUTES.guide} className="hover:underline">Guide</Link>
            </nav>
          </div>

          {/* How it works */}
          <aside className="rounded-lg border border-orange-500/30 bg-orange-500/10 p-4 text-sm" role="note">
            <p className="font-semibold text-orange-600">How this playground works</p>
            <ul className="mt-2 space-y-1 text-muted-foreground">
              <li>Synthetic data only. Nothing here is a real patient, lab result, or payment.</li>
              <li>State lives in this browser (IndexedDB). It does not write to production SYNAPSE.</li>
              <li>Pick a role, walk Reception → Nurse → Doctor → Lab → Pharmacy → Billing, then open Timeline.</li>
              <li>Use Show Controls to switch facility/role, go offline, export, or reset.</li>
            </ul>
          </aside>
          {requiresRole && session && !requiresRole.includes(session.role) && (
            <div className="rounded-lg border border-orange-500/20 bg-orange-500/10 p-4">
              <div className="flex items-center gap-2">
                <span className="text-xl">⚠️</span>
                <div>
                  <p className="font-semibold text-orange-500">Role Mismatch</p>
                  <p className="text-sm text-muted-foreground">
                    This page expects: {requiresRole.join(", ")}. You are: {session.role}.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Context Info */}
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center justify-between gap-3 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-semibold">Patient:</span>
                <span>Amina Demo (SYN-UG-DEMO-0001)</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <span>🔒 No real patient data</span>
              </div>
            </div>
          </div>

          {/* Page Content */}
          {children}
        </div>
      </div>
    </main>
  )
}
