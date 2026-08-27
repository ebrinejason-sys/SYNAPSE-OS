"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { FlaskConical, Hospital, Play, RotateCcw, Spline } from "lucide-react"
import { PlatformPageHeader } from "../_components/platform-page-header"

type Tenant = { id: string; name: string; slug: string; kind: string; createdAt: string }
type Run = {
  id: string
  seed: number
  scenario: string
  tenantId: string
  status: string
  correlationId: string
  notes: string[]
  patient: { name: string; synapseId: string; mrn: string } | null
  encounter: { type: string; chiefComplaint: string } | null
  carePlan: { pathwayId: string; pathwayVersion: string; status: string; steps: Array<{ stepId: string; status: string }> } | null
  labOrder: { id: string; testName: string; status: string; accessionNumber: string | null } | null
  labResult: { resultValue: string; flag: string; isCritical: boolean; status: string } | null
  prescription: { medicationDisplay: string; status: string } | null
  dispense: { remainingStock: number; batch: string } | null
  events: Array<{ event_id: string; event_type: string; source: string; timestamp: string }>
  timeline: Array<{ title: string; eventType: string }>
}

export default function SimulationLabPage() {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [runs, setRuns] = useState<Run[]>([])
  const [tenantId, setTenantId] = useState("")
  const [seed, setSeed] = useState("20260829")
  const [scenario, setScenario] = useState("sepsis-critical-lab")
  const [pauseAt, setPauseAt] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const res = await fetch("/api/platform/simulation", { cache: "no-store" })
    if (!res.ok) throw new Error("Failed to load simulation state")
    const data = (await res.json()) as { tenants: Tenant[]; runs: Run[] }
    setTenants(data.tenants)
    setRuns(data.runs)
    setTenantId((current) => current || data.tenants[0]?.id || "")
    setSelectedId((current) => current || data.runs.at(-1)?.id || null)
  }, [])

  useEffect(() => {
    refresh().catch((err) => setError(err instanceof Error ? err.message : "load_failed"))
  }, [refresh])

  async function post(action: string, extra: Record<string, unknown> = {}) {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/platform/simulation", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "request_failed")
      await refresh()
      if (data.run?.id) setSelectedId(data.run.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : "request_failed")
    } finally {
      setBusy(false)
    }
  }

  const selected = useMemo(() => runs.find((run) => run.id === selectedId) ?? runs.at(-1) ?? null, [runs, selectedId])

  return (
    <div className="space-y-6">
      <PlatformPageHeader
        eyebrow="Demo & Simulation Lab"
        title="Create a fictional hospital and run a clinical scenario"
        description="Synthetic data is always marked. Production tenants cannot be reset. The sepsis scenario is the complete OS → Lab → Pharm journey."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-2xl border border-subtle bg-surface p-5 lg:col-span-1">
          <h2 className="text-sm font-semibold text-primary-color">Environment</h2>
          <div className="mt-4 space-y-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => post("create_tenant", { kind: "hospital" })}
              className="flex w-full items-center gap-2 rounded-xl border border-[#F97316]/30 bg-[#F97316]/10 px-3 py-2 text-sm text-[#F97316]"
            >
              <Hospital className="h-4 w-4" /> Create Demo Hospital
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => post("create_tenant", { kind: "pharmacy" })}
              className="flex w-full items-center gap-2 rounded-xl border border-subtle px-3 py-2 text-sm text-secondary-color"
            >
              Create Demo Pharmacy
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => post("create_tenant", { kind: "laboratory" })}
              className="flex w-full items-center gap-2 rounded-xl border border-subtle px-3 py-2 text-sm text-secondary-color"
            >
              Create Demo Laboratory
            </button>
            <label className="block text-xs text-muted-color">
              Demo tenant
              <select
                className="mt-1 w-full rounded-lg border border-subtle bg-base px-3 py-2 text-sm text-primary-color"
                value={tenantId}
                onChange={(event) => setTenantId(event.target.value)}
              >
                {tenants.length === 0 ? <option value="">Create a tenant first</option> : null}
                {tenants.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-muted-color">
              Scenario
              <select
                className="mt-1 w-full rounded-lg border border-subtle bg-base px-3 py-2 text-sm text-primary-color"
                value={scenario}
                onChange={(event) => setScenario(event.target.value)}
              >
                <option value="sepsis-critical-lab">Sepsis + critical lab</option>
                <option value="opd-malaria">OPD malaria</option>
                <option value="pneumonia">Pneumonia</option>
                <option value="dka">DKA</option>
                <option value="pharmacy-retail">Pharmacy retail</option>
                <option value="stockout">Stockout</option>
                <option value="insurance-claim">Insurance claim</option>
                <option value="referral">Referral</option>
              </select>
            </label>
            <label className="block text-xs text-muted-color">
              Seed
              <input
                className="mt-1 w-full rounded-lg border border-subtle bg-base px-3 py-2 text-sm text-primary-color"
                value={seed}
                onChange={(event) => setSeed(event.target.value)}
              />
            </label>
            <label className="block text-xs text-muted-color">
              Pause for human workflow
              <select
                className="mt-1 w-full rounded-lg border border-subtle bg-base px-3 py-2 text-sm text-primary-color"
                value={pauseAt}
                onChange={(event) => setPauseAt(event.target.value)}
              >
                <option value="">Run complete journey</option>
                <option value="lab_order">Pause after lab order</option>
                <option value="result_entry">Pause after specimen receipt</option>
                <option value="prescription">Pause before prescription</option>
              </select>
            </label>
            <button
              type="button"
              disabled={busy || !tenantId}
              onClick={() =>
                post("run_scenario", {
                  tenantId,
                  scenario,
                  seed: Number(seed) || 20260829,
                  pauseAt: pauseAt || null,
                })
              }
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#F97316] px-3 py-2.5 text-sm font-semibold text-black"
            >
              <Play className="h-4 w-4" /> Run scenario
            </button>
            <button
              type="button"
              disabled={busy || !tenantId}
              onClick={() => post("reset", { tenantId })}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/30 px-3 py-2 text-sm text-red-300"
            >
              <RotateCcw className="h-4 w-4" /> Reset demo tenant
            </button>
            {error ? <p className="text-xs text-red-300">{error}</p> : null}
            <p className="text-[11px] leading-relaxed text-muted-color">
              Reset is blocked unless the tenant is classified demo and synthetic. This control never targets production clinical data.
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-subtle bg-surface p-5 lg:col-span-2">
          {!selected ? (
            <p className="text-sm text-muted-color">Run a scenario to inspect the generated patient, events, and timeline.</p>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-[#E8B84B]">{selected.scenario}</p>
                  <h2 className="mt-1 text-lg font-semibold text-primary-color">{selected.patient?.name ?? "Synthetic run"}</h2>
                  <p className="text-xs text-muted-color">
                    {selected.patient?.synapseId} · {selected.patient?.mrn} · seed {selected.seed} · {selected.status}
                  </p>
                </div>
                <Link href={`/platform/events?correlationId=${selected.correlationId}`} className="text-xs text-[#F97316]">
                  Open event trace
                </Link>
              </div>

              <ol className="grid gap-2 sm:grid-cols-2">
                {[
                  ["Encounter", selected.encounter?.chiefComplaint],
                  ["Pathway", selected.carePlan ? `${selected.carePlan.pathwayId} v${selected.carePlan.pathwayVersion}` : null],
                  ["Lab", selected.labOrder ? `${selected.labOrder.testName} · ${selected.labOrder.status}` : null],
                  ["Result", selected.labResult ? `${selected.labResult.resultValue} ${selected.labResult.flag}` : null],
                  ["Prescription", selected.prescription?.medicationDisplay],
                  ["Dispense", selected.dispense ? `stock ${selected.dispense.remainingStock} · ${selected.dispense.batch}` : null],
                ].map(([label, value]) => (
                  <li key={String(label)} className="rounded-xl border border-subtle bg-base px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-muted-color">{label}</p>
                    <p className="mt-1 text-sm text-primary-color">{value ?? "—"}</p>
                  </li>
                ))}
              </ol>

              <div>
                <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-primary-color">
                  <Spline className="h-4 w-4 text-[#E8B84B]" /> Event chain
                </h3>
                <ol className="space-y-1">
                  {selected.events.map((event) => (
                    <li key={event.event_id} className="flex items-center justify-between rounded-lg bg-base px-3 py-1.5 text-xs">
                      <span className="font-medium text-primary-color">{event.event_type}</span>
                      <span className="text-muted-color">{event.source}</span>
                    </li>
                  ))}
                </ol>
              </div>

              {selected.labOrder ? (
                <Link
                  href="/lab/orders"
                  className="inline-flex items-center gap-2 text-sm text-[#F97316]"
                >
                  <FlaskConical className="h-4 w-4" /> Open Synapse Lab worklist
                </Link>
              ) : null}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
