"use client"

import { useEffect, useState } from "react"
import { DemoShell } from "../../../components/demo/DemoShell"
import { DemoIntelligenceCopilot, type DemoCopilotPacket } from "../../../components/demo/DemoIntelligenceCopilot"
import {
  getLabResults,
  getPerson,
  initializePlayground,
} from "../../../lib/demo/browser-repository"

export default function DemoIntelligencePage() {
  const [packet, setPacket] = useState<DemoCopilotPacket>({
    patientId: "demo-person-amina",
    tenantId: "demo-hospital",
    clinicianId: "doctor-demo",
    presentingComplaint: "Fever and headache for 3 days",
  })
  const [context, setContext] = useState("Loading synthetic Amina Demo context…")

  useEffect(() => {
    void (async () => {
      await initializePlayground()
      const person = await getPerson("demo-person-amina")
      const results = await getLabResults()
      const laboratory = results
        .filter((row) => row.status === "released" || row.status === "entered" || row.status === "verified")
        .map((row) => ({
          test: String(row.testName ?? row.testCode ?? "result"),
          value: String(row.value ?? ""),
          flag: row.interpretation === "high" || row.interpretation === "critical" ? "H" : undefined,
        }))
      setPacket({
        patientId: "demo-person-amina",
        tenantId: "demo-hospital",
        clinicianId: "doctor-demo",
        presentingComplaint: "Fever and headache for 3 days",
        laboratory,
      })
      setContext(
        person
          ? `Synthetic patient ${person.name} (${person.synapseId}). Demo labs: ${laboratory.map((row) => `${row.test} ${row.value}`).join("; ") || "none yet"}.`
          : "Synthetic patient unavailable",
      )
    })()
  }, [])

  return (
    <DemoShell title="Synapse Intelligence" description="Synthetic decision support playground. AI cannot sign, verify, release, or dispense.">
      <div className="space-y-4">
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{context}</p>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          AI-generated decision support. Synthetic demonstration data. Requires qualified human review.
        </p>
        <DemoIntelligenceCopilot packet={packet} defaultTask="clinical_copilot" entryLabel="Synapse AI" />
        <DemoIntelligenceCopilot
          packet={packet}
          defaultTask="lab_interpretation"
          entryLabel="AI Result Analysis"
          allowTaskSwitch={false}
        />
      </div>
    </DemoShell>
  )
}
