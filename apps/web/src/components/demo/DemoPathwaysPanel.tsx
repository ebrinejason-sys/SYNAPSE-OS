"use client"

import { useEffect, useState } from "react"
import {
  appendAuditEvent,
  completeDemoCarePlanStep,
  getDemoCarePlans,
  overrideDemoCarePlanStep,
  saveDemoCarePlan,
  saveIntelligenceDecision,
  type DemoCarePlan,
} from "../../lib/demo/browser-repository"

export function DemoPathwaysPanel({
  patientId,
  encounterId,
  presentingComplaint,
  laboratory,
}: {
  patientId: string
  encounterId: string
  presentingComplaint: string
  laboratory?: Array<{ test: string; value: string; flag?: string }>
}) {
  const [plans, setPlans] = useState<DemoCarePlan[]>([])
  const [suggestion, setSuggestion] = useState<{ id: string; name: string; why: string; version: string; source: string } | null>(null)
  const [error, setError] = useState("")
  const [reason, setReason] = useState("")

  useEffect(() => {
    void getDemoCarePlans().then((rows) => setPlans(rows.filter((row) => row.encounterId === encounterId)))
  }, [encounterId])

  async function askAi() {
    setError("")
    const res = await fetch("/api/demo/intelligence", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        task: "pathway_copilot",
        packet: {
          patientId,
          tenantId: "demo-hospital",
          clinicianId: "doctor-demo",
          presentingComplaint,
          laboratory,
        },
      }),
    })
    const json = await res.json()
    if (!res.ok) {
      setError(typeof json.error === "string" ? json.error : "AI assistance unavailable")
      return
    }
    const rec = json.recommendation
    setSuggestion({
      id: rec.suggestedPathwayId ?? "pathway.adult-sepsis",
      name: rec.recommendation,
      why: rec.reasoningSummary,
      version: "1.0.0",
      source: rec.provenance?.promptVersion ?? "pathway_copilot",
    })
  }

  async function activate() {
    if (!suggestion) return
    const plan = await saveDemoCarePlan({
      id: crypto.randomUUID(),
      patientId,
      encounterId,
      pathwayId: suggestion.id,
      pathwayVersion: suggestion.version,
      status: "active",
      currentStep: "assess",
      recommendedAction: "Activate after clinician confirmation",
      actualAction: null,
      overrideReason: null,
    })
    await saveIntelligenceDecision({
      recommendationId: suggestion.id,
      task: "pathway_copilot",
      decision: "ACCEPT",
      clinicianId: "doctor-demo",
      reason: "Clinician activated suggested pathway",
    })
    await appendAuditEvent({ type: "pathway_activated", actorId: "doctor-demo", pathwayId: suggestion.id })
    setPlans(await getDemoCarePlans())
    return plan
  }

  async function complete(plan: DemoCarePlan) {
    await completeDemoCarePlanStep(plan.id, "Clinician confirmed recommended step")
    setPlans(await getDemoCarePlans())
  }

  async function override(plan: DemoCarePlan) {
    if (!reason.trim()) {
      setError("Override reason required")
      return
    }
    await overrideDemoCarePlanStep(plan.id, "Modified step", reason)
    setPlans(await getDemoCarePlans())
  }

  return (
    <section className="demo-card mt-4 p-4">
      <h2 className="font-semibold">Clinical pathways</h2>
      <p className="text-xs text-muted-foreground">Synthetic demonstration data. AI may suggest a pathway; it cannot activate or order.</p>
      {error ? <p className="mt-2 text-sm text-amber-600">{error}</p> : null}
      <button type="button" className="demo-btn-primary mt-3" onClick={() => void askAi()}>Ask Synapse AI for pathway</button>
      {suggestion ? (
        <div className="mt-3 rounded border p-3 text-sm">
          <p className="font-medium">{suggestion.name}</p>
          <p>Why suggested: {suggestion.why}</p>
          <p>Source: {suggestion.source} · Version {suggestion.version}</p>
          <p>Key trigger: presenting complaint</p>
          <button type="button" className="demo-btn-primary mt-2" onClick={() => void activate()}>Open / activate pathway</button>
        </div>
      ) : null}
      <ul className="mt-3 space-y-2 text-sm">
        {plans.map((plan) => (
          <li key={plan.id} className="rounded border p-3">
            <p>{plan.pathwayId} · {plan.status} · v{plan.pathwayVersion}</p>
            {plan.status === "active" ? (
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" className="rounded border px-2 py-1 text-xs" onClick={() => void complete(plan)}>Accept recommended step</button>
                <input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Override reason" className="rounded border px-2 py-1 text-xs" />
                <button type="button" className="rounded border px-2 py-1 text-xs" onClick={() => void override(plan)}>Modify step</button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  )
}
