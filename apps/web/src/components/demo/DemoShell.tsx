"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { resetDemoPlayground, exportDemoPlayground, importDemoPlayground, getFacilities, getUsers, initializePlayground } from "../../lib/demo/browser-repository"
import type { DemoFacility, DemoUser } from "../../lib/demo/entities"
import { DEMO_ROUTES, demoHref } from "../../lib/demo/paths"
import { DemoMast } from "./DemoMast"

const STATIONS = [
  { label: "Reception", href: DEMO_ROUTES.reception, leaf: "reception" },
  { label: "Nurse", href: DEMO_ROUTES.nurse, leaf: "nurse" },
  { label: "Doctor", href: DEMO_ROUTES.doctor, leaf: "doctor" },
  { label: "Lab", href: DEMO_ROUTES.lab, leaf: "lab" },
  { label: "Pharmacy", href: DEMO_ROUTES.pharmacist, leaf: "pharmacist" },
  { label: "Billing", href: DEMO_ROUTES.billing, leaf: "billing" },
] as const

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

    try {
      await initializePlayground()
    } catch {
      // IndexedDB can be blocked; still show a usable playground identity.
    }

    const facilities = await getFacilities().catch(() => [] as DemoFacility[])
    const users = await getUsers().catch(() => [] as DemoUser[])
    const facility = facilities.find((f) => f.id === storedFacility)
    const user = users.find((u) => u.role === storedRole)

    setSession({
      facilityId: facility?.id ?? storedFacility,
      facilityName: facility?.name ?? "SYNAPSE Demo Hospital",
      role: user?.role ?? storedRole,
      userName: user?.name ?? "Demo visitor",
      userId: user?.id ?? "demo-visitor",
      online: storedOnline,
    })
  }

  async function loadData() {
    try {
      const [facs, usrs] = await Promise.all([getFacilities(), getUsers()])
      setFacilities(facs)
      setUsers(usrs)
    } catch {
      setFacilities([])
      setUsers([])
    }
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
  const pathname = usePathname()

  return (
    <main className="min-h-screen">
      <DemoMast>
        <div className="hidden items-center gap-2 font-mono text-xs sm:flex" style={{ color: "var(--text-secondary)" }}>
          <span>{FACILITY_ICONS[currentFacility?.type ?? ""] ?? "▣"}</span>
          <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{session?.facilityName || "Loading chart…"}</span>
          <span aria-hidden="true">/</span>
          <span style={{ color: roleColor }}>{session?.userName || "…"}</span>
        </div>
        <button
          type="button"
          onClick={toggleOnline}
          className="px-3 py-1 text-xs font-semibold"
          style={{
            background: session?.online ? "rgba(15,118,110,0.12)" : "rgba(239,68,68,0.08)",
            color: session?.online ? "var(--brand-teal)" : "#EF4444",
            border: `2px solid ${session?.online ? "var(--brand-teal)" : "#EF4444"}`,
          }}
        >
          {session?.online ? "On chart" : "Offline"}
        </button>
        {!session?.online && pendingSyncCount > 0 && (
          <span className="border px-2 py-1 text-xs font-semibold">{pendingSyncCount} pending</span>
        )}
        <button
          type="button"
          onClick={() => setShowControls(!showControls)}
          className="border bg-secondary px-3 py-1 text-xs font-semibold"
        >
          {showControls ? "Hide board" : "Open board"}
        </button>
      </DemoMast>

      <div className="mx-auto max-w-5xl px-4 py-6">
        <div className="demo-station-pack mb-5">
        <nav className="demo-ledger" aria-label="Clinical stations">
          {STATIONS.map((station) => (
            <Link
              key={station.href}
              href={station.href}
              aria-current={pathname?.startsWith(station.href) ? "page" : undefined}
              onClick={(event) => {
                event.preventDefault()
                window.location.assign(demoHref(station.leaf))
              }}
            >
              {station.label}
            </Link>
          ))}
        </nav>

        {showControls && (
          <div className="demo-card mb-5 space-y-3 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Facility</span>
              {facilities.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => switchFacility(f.id)}
                  className="border px-3 py-1 text-xs font-medium"
                  style={session?.facilityId === f.id ? { background: "var(--brand-orange)", color: "#07070A", borderColor: "var(--brand-orange)" } : undefined}
                >
                  {FACILITY_ICONS[f.type] ?? "▣"} {f.name}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Role</span>
              {Array.from(new Set(users.map((u) => u.role))).map((role) => {
                const user = users.find((u) => u.role === role)
                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() => switchRole(role)}
                    className="border px-3 py-1 text-xs font-medium"
                    style={session?.role === role ? { backgroundColor: ROLE_COLORS[role] ?? "#6B7280", color: "#fff", borderColor: ROLE_COLORS[role] ?? "#6B7280" } : undefined}
                  >
                    {user?.name}
                  </button>
                )
              })}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Chart</span>
              <button type="button" onClick={handleExport} className="border px-3 py-1 text-xs font-medium">Export</button>
              <button type="button" onClick={handleImport} className="border px-3 py-1 text-xs font-medium">Import</button>
              <button type="button" onClick={handleReset} className="border px-3 py-1 text-xs font-medium text-destructive">Reset</button>
            </div>
          </div>
        )}

        <div className="demo-frame space-y-6 p-5 sm:p-7">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b-2 pb-4" style={{ borderColor: "var(--demo-ink)" }}>
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: "var(--text-muted)" }}>Station chart</p>
              <h1 className="font-display text-3xl font-bold tracking-tight">{title}</h1>
            </div>
            <nav className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs uppercase tracking-wider">
              <Link href={DEMO_ROUTES.home} className="hover:underline">Home</Link>
              <Link href={DEMO_ROUTES.workspace} className="hover:underline">Workspace</Link>
              <Link href={DEMO_ROUTES.timeline} className="hover:underline">Timeline</Link>
              <Link href={DEMO_ROUTES.network} className="hover:underline">Network</Link>
              <Link href={DEMO_ROUTES.guide} className="hover:underline">Guide</Link>
            </nav>
          </div>

          <aside className="demo-card p-4 text-sm" role="note">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "var(--brand-orange)" }}>How this playground works</p>
            <ul className="mt-2 space-y-1" style={{ color: "var(--text-secondary)" }}>
              <li>Synthetic data only. Nothing here is a real patient, lab result, or payment.</li>
              <li>State lives in this browser. It does not write to production SYNAPSE.</li>
              <li>Walk Reception → Nurse → Doctor → Lab → Pharmacy → Billing, then open Timeline.</li>
              <li>Open board to switch facility or role, go offline, export, or reset.</li>
            </ul>
          </aside>

          {requiresRole && session && !requiresRole.includes(session.role) && (
            <div className="demo-card p-4">
              <p className="font-semibold" style={{ color: "var(--brand-orange)" }}>Role mismatch</p>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                This page expects {requiresRole.join(", ")}. You are {session.role}.
              </p>
            </div>
          )}

          <div className="demo-card flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
            <div>
              <span className="font-mono text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Patient</span>
              <p className="font-semibold">Amina Demo · SYN-UG-DEMO-0001</p>
            </div>
            <span className="demo-stamp">No real patient data</span>
          </div>

          <div className="demo-work space-y-6">{children}</div>
        </div>
        </div>
      </div>
    </main>
  )
}
