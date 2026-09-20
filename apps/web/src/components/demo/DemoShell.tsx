"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import {
  exportDemoPlayground,
  importDemoPlayground,
  initializePlayground,
  resetDemoPlayground,
} from "../../lib/demo/browser-repository"
import { demoHref } from "../../lib/demo/paths"
import {
  applyStationSession,
  DEMO_STATIONS,
  DEMO_TIP_STORAGE_KEY,
  enterStation,
  readDemoRole,
  stationFromPath,
  stationHref,
  type DemoStationId,
} from "../../lib/demo/stations"
import { loadJourneyProgress, type JourneyProgress } from "../../lib/demo/journey-progress"
import { DemoMast } from "./DemoMast"
import { DemoThemeControl } from "./DemoThemeControl"

const ROLE_LABEL: Record<string, string> = {
  reception: "Reception",
  nurse: "Nurse",
  doctor: "Doctor",
  lab_technician: "Lab Technician",
  lab_scientist: "Lab Scientist",
  pharmacist: "Pharmacist",
  cashier: "Cashier",
  admin: "Admin",
}

interface DemoShellProps {
  title: string
  description?: string
  children: React.ReactNode
  requiresRole?: string[]
}

function initialSession() {
  if (typeof window === "undefined") {
    return { facilityName: "Demo Hospital", role: "reception", userName: "Visitor" }
  }
  const role = readDemoRole()
  const facilityId = sessionStorage.getItem("synapse_demo_facility") || "demo-hospital"
  const facilityName =
    facilityId === "demo-lab" ? "Demo Lab" : facilityId === "demo-pharmacy" ? "Demo Pharmacy" : "Demo Hospital"
  return { facilityName, role, userName: ROLE_LABEL[role] ?? "Visitor" }
}

export function DemoShell({ title, description, children, requiresRole }: DemoShellProps) {
  const pathname = usePathname() || "/demo"
  const search = typeof window !== "undefined" ? window.location.search : ""
  const pathStation = stationFromPath(pathname, search)
  const [session, setSession] = useState(initialSession)
  const [ready, setReady] = useState(typeof window !== "undefined")
  const [slow, setSlow] = useState(false)
  const [tipDismissed, setTipDismissed] = useState(true)
  const [moreOpen, setMoreOpen] = useState(false)
  const [progress, setProgress] = useState<JourneyProgress | null>(null)
  const railRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), 4000)
    applyStationSession(pathStation.id)
    setSession(initialSession())
    setTipDismissed(localStorage.getItem(DEMO_TIP_STORAGE_KEY) === "1")
    void (async () => {
      try {
        await initializePlayground()
        setProgress(await loadJourneyProgress())
      } catch {
        setProgress(null)
      } finally {
        setReady(true)
        window.clearTimeout(timer)
      }
    })()
    return () => window.clearTimeout(timer)
  }, [pathStation.id])

  useEffect(() => {
    const active = railRef.current?.querySelector("[aria-current='step'], [aria-current='page']")
    if (active instanceof HTMLElement) active.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" })
  }, [pathStation.id, progress])

  const mismatch = Boolean(requiresRole && session.role && !requiresRole.includes(session.role))
  const expectedRole = requiresRole?.[0]

  function dismissTip() {
    localStorage.setItem(DEMO_TIP_STORAGE_KEY, "1")
    setTipDismissed(true)
  }

  async function handleReset() {
    if (!confirm("Reset the synthetic playground? Theme and tips are kept.")) return
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
    input.onchange = async (event) => {
      const file = (event.target as HTMLInputElement).files?.[0]
      if (!file) return
      await importDemoPlayground(JSON.parse(await file.text()))
      window.location.reload()
    }
    input.click()
  }

  return (
    <main className="min-h-screen">
      <DemoMast badge="TEST DRIVE / SYNTHETIC">
        <span className="demo-patient-chip">
          {progress?.patientName ?? "Amina Demo"}
        </span>
        <select
          aria-label="Switch demo facility"
          className="demo-icon-btn max-w-[9.5rem]"
          value={session.facilityName === "Demo Lab" ? "lab" : session.facilityName === "Demo Pharmacy" ? "pharmacist" : "reception"}
          onChange={(event) => enterStation(event.target.value as DemoStationId)}
        >
          <option value="reception">Hospital</option>
          <option value="lab">Lab</option>
          <option value="pharmacist">Pharmacy</option>
        </select>
        <span className="hidden text-xs sm:inline" style={{ color: "var(--text-secondary)" }}>
          {session.facilityName} · {ROLE_LABEL[session.role] ?? session.role}
        </span>
        <DemoThemeControl />
        <div className="relative">
          <button type="button" className="demo-icon-btn" aria-label="More playground actions" onClick={() => setMoreOpen((v) => !v)}>
            More
          </button>
          {moreOpen ? (
            <div className="demo-menu">
              <button type="button" onClick={() => window.location.assign(demoHref("guide"))}>Guide</button>
              <button type="button" onClick={() => window.location.assign(demoHref("intelligence"))}>Intelligence</button>
              <button type="button" onClick={handleExport}>Export</button>
              <button type="button" onClick={handleImport}>Import</button>
              <button type="button" onClick={() => window.location.assign(demoHref("network"))}>Network</button>
              <button type="button" onClick={() => window.location.assign(demoHref("admin"))}>Admin</button>
              <button type="button" className="text-destructive" onClick={handleReset}>Reset Playground</button>
            </div>
          ) : null}
        </div>
      </DemoMast>

      <div className="mx-auto max-w-6xl px-4 py-4 sm:py-6">
        <nav ref={railRef} className="demo-rail" aria-label="Golden journey stations">
          {DEMO_STATIONS.map((station) => {
            const done = progress?.complete[station.progressKey]
            const current = progress?.current === station.progressKey
            const active = pathStation.id === station.id
            return (
              <a
                key={station.id}
                href={stationHref(station.id)}
                className={active ? "is-active" : undefined}
                aria-current={active ? "page" : current ? "step" : undefined}
                onClick={() => applyStationSession(station.id)}
              >
                <span>{done ? "✓ " : current ? "● " : ""}{station.label}</span>
              </a>
            )
          })}
        </nav>

        <div className="demo-patient-strip" aria-label="Synthetic patient context">
          <strong>{progress?.patientName ?? "Amina Demo"}</strong>
          <span className="demo-stamp">SYNTHETIC CHART</span>
          <span>{progress?.patientSex ?? "Female"} · {progress?.patientAge ?? "24y"}</span>
          <span>Current visit: {progress?.visitLabel ?? "OPD"}</span>
        </div>

        {!tipDismissed ? (
          <aside className="demo-tip" role="note">
            <p>Tip: follow the station rail from Reception → Billing.</p>
            <div className="flex gap-2">
              <button type="button" className="demo-btn-secondary" onClick={dismissTip}>Dismiss</button>
              <button type="button" className="demo-btn-secondary" onClick={() => window.location.assign(demoHref("guide"))}>Guide</button>
            </div>
          </aside>
        ) : null}

        <section className="demo-work mt-4 space-y-5">
          <header>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: "var(--text-muted)" }}>Station</p>
            <h1 className="font-display text-3xl font-bold tracking-tight">{title}</h1>
            {description ? <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>{description}</p> : null}
          </header>

          {mismatch && expectedRole ? (
            <div className="demo-card space-y-3 p-4">
              <p className="font-semibold">You&apos;re currently using the {ROLE_LABEL[session.role] ?? session.role} role.</p>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                This station needs {ROLE_LABEL[expectedRole] ?? expectedRole}.
              </p>
              <button
                type="button"
                className="demo-btn-primary"
                onClick={() => {
                  const station = DEMO_STATIONS.find((row) => row.role === expectedRole)
                  enterStation((station?.id ?? "reception") as DemoStationId)
                }}
              >
                Continue as {ROLE_LABEL[expectedRole] ?? expectedRole}
              </button>
            </div>
          ) : null}

          {!ready && slow ? (
            <div className="demo-card space-y-3 p-4">
              <p>Still loading the synthetic chart.</p>
              <div className="flex gap-2">
                <button type="button" className="demo-btn-primary" onClick={() => window.location.reload()}>Retry</button>
                <button type="button" className="demo-btn-secondary" onClick={handleReset}>Reset Playground</button>
              </div>
            </div>
          ) : (
            children
          )}
        </section>
      </div>
    </main>
  )
}
