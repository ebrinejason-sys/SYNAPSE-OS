"use client"

import { useEffect, useState } from "react"
import {
  getIntelligenceDecisions,
  saveIntelligenceDecision,
  type DemoIntelligenceDecision,
} from "../../lib/demo/browser-repository"

type LabRow = { test: string; value: string; flag?: string }

export type DemoCopilotPacket = {
  patientId: string
  tenantId: string
  clinicianId: string
  presentingComplaint: string
  history?: string[]
  examination?: string[]
  vitals?: Record<string, number | string | undefined>
  laboratory?: LabRow[]
  medications?: string[]
  allergies?: string[]
  previousEncounters?: string[]
}

type Recommendation = {
  id: string
  task: string
  recommendation: string
  reasoningSummary: string
  supportingEvidence: string[]
  contradictingEvidence: string[]
  missingInformation: string[]
  confidence: number
  cannotMiss: boolean
  suggestedPathwayId: string | null
  icd11Candidates?: Array<{ stemCode?: string; title?: string }>
  provenance: { model: string | null; promptVersion: string }
}

export function DemoIntelligenceCopilot({
  packet,
  defaultTask = "clinical_copilot",
  entryLabel = "Synapse AI",
  allowTaskSwitch = true,
}: {
  packet: DemoCopilotPacket
  defaultTask?: string
  entryLabel?: string
  allowTaskSwitch?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [task, setTask] = useState(defaultTask)
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null)
  const [label, setLabel] = useState("")
  const [error, setError] = useState("")
  const [reason, setReason] = useState("")
  const [decisions, setDecisions] = useState<DemoIntelligenceDecision[]>([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void getIntelligenceDecisions().then(setDecisions).catch(() => undefined)
  }, [])

  async function run() {
    setBusy(true)
    setError("")
    try {
      const res = await fetch("/api/demo/intelligence", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ task, packet }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(typeof json.error === "string" ? json.error : "AI assistance unavailable")
        return
      }
      setLabel(json.label)
      setRecommendation(json.recommendation)
      setDecisions(await getIntelligenceDecisions())
    } catch {
      setError("AI assistance unavailable")
    } finally {
      setBusy(false)
    }
  }

  async function decide(decision: DemoIntelligenceDecision["decision"]) {
    if (!recommendation) return
    if ((decision === "MODIFY" || decision === "REJECT") && !reason.trim()) {
      setError("Capture a reason for modify or reject.")
      return
    }
    await saveIntelligenceDecision({
      recommendationId: recommendation.id,
      task: recommendation.task,
      decision,
      reason: reason.trim() || null,
      clinicianId: packet.clinicianId,
    })
    setDecisions(await getIntelligenceDecisions())
    setReason("")
    setError("")
  }

  return (
    <section className="demo-card space-y-3 p-4" aria-label={entryLabel}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-semibold">{entryLabel}</p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Decision support only. AI cannot sign, verify, release, or dispense.
          </p>
        </div>
        <button type="button" className="demo-btn-secondary text-sm" onClick={() => setOpen((value) => !value)}>
          {open ? "Hide" : entryLabel}
        </button>
      </div>
      {open ? (
        <div className="space-y-3">
          {allowTaskSwitch ? (
            <label className="block text-sm">
              Task
              <select
                title="Intelligence task"
                className="mt-1 w-full rounded-lg border px-3 py-2"
                value={task}
                onChange={(event) => setTask(event.target.value)}
              >
                <option value="clinical_copilot">Clinical reasoning</option>
                <option value="lab_interpretation">Lab interpretation</option>
                <option value="coding_copilot">ICD-11</option>
                <option value="pathway_copilot">Guidelines</option>
              </select>
            </label>
          ) : null}
          <button type="button" className="demo-btn-primary text-sm" disabled={busy} onClick={() => void run()}>
            {busy ? "Generating…" : "Generate suggestion"}
          </button>
          {error ? <p className="text-sm text-red-500">{error}</p> : null}
          {recommendation ? (
            <div className="space-y-2 rounded-xl border p-3 text-sm">
              <p className="text-xs uppercase tracking-wide">
                AI-generated decision support · Synthetic demonstration data · Requires qualified human review
              </p>
              <p className="text-xs">{label}</p>
              <p className="font-semibold">{recommendation.recommendation}</p>
              <p>{recommendation.reasoningSummary}</p>
              <p>
                Confidence {Math.round(recommendation.confidence * 100)}%
                {recommendation.cannotMiss ? " · cannot-miss flag" : ""}
              </p>
              <p>Pathway: {recommendation.suggestedPathwayId ?? "none"}</p>
              <p>Model: {recommendation.provenance.model} · {recommendation.provenance.promptVersion}</p>
              <ul className="list-disc pl-5">
                {recommendation.supportingEvidence.map((item) => <li key={`s-${item}`}>Support: {item}</li>)}
                {recommendation.contradictingEvidence.map((item) => <li key={`c-${item}`}>Contradiction: {item}</li>)}
                {recommendation.missingInformation.map((item) => <li key={`m-${item}`}>Missing: {item}</li>)}
                {(recommendation.icd11Candidates ?? []).slice(0, 3).map((item) => (
                  <li key={`i-${item.stemCode ?? item.title}`}>ICD-11 candidate: {item.stemCode} {item.title}</li>
                ))}
              </ul>
              <textarea
                className="w-full rounded-lg border px-3 py-2 text-sm"
                placeholder="Reason for modify/reject"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                <button type="button" className="demo-btn-primary text-sm" onClick={() => void decide("ACCEPT")}>Accept</button>
                <button type="button" className="demo-btn-secondary text-sm" onClick={() => void decide("MODIFY")}>Modify</button>
                <button type="button" className="demo-btn-secondary text-sm" onClick={() => void decide("REJECT")}>Reject</button>
                <button type="button" className="demo-btn-secondary text-sm" onClick={() => void decide("DEFER")}>Defer</button>
              </div>
            </div>
          ) : null}
          {decisions.length > 0 ? (
            <ul className="space-y-1 text-xs">
              {decisions.map((row) => (
                <li key={row.id}>{row.decision} · {row.task} · {row.reason || "no reason"}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
