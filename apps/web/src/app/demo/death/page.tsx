"use client"

import { useEffect, useState } from "react"
import { DemoShell } from "../../../components/demo/DemoShell"
import { applyStationSession } from "../../../lib/demo/stations"
import {
  appendAuditEvent,
  appendTimelineEvent,
  getPersons,
  saveDemoDeathPronouncement,
  saveDemoMortuaryBody,
  type DemoDeathPronouncement,
  type DemoMortuaryBody,
} from "../../../lib/demo/browser-repository"

export default function DemoDeathPage() {
  const [precision, setPrecision] = useState<"EXACT" | "ESTIMATED" | "UNKNOWN">("EXACT")
  const [record, setRecord] = useState<DemoDeathPronouncement | null>(null)
  const [body, setBody] = useState<DemoMortuaryBody | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    applyStationSession("doctor")
  }, [])

  async function pronounce() {
    setError("")
    const persons = await getPersons()
    const joseph = persons.find((row) => row.id === "demo-person-joseph")
    if (!joseph) {
      setError("Synthetic death case is missing from playground data.")
      return
    }
    const next = await saveDemoDeathPronouncement({
      id: crypto.randomUUID(),
      personId: joseph.id,
      encounterId: "demo-death-encounter",
      precision,
      deathDateTime: precision === "EXACT" ? new Date().toISOString() : null,
      deathTimeText: precision === "EXACT" ? null : precision === "ESTIMATED" ? "approximately 03:30" : "date known, exact time unknown",
      pronouncedBy: "doctor-demo",
      nextOfKinNotified: false,
    })
    await appendTimelineEvent({ type: "death_pronounced", personId: joseph.id, title: "Death pronounced", summary: `Precision ${precision}` })
    await appendAuditEvent({ type: "death_pronounced", actorId: "doctor-demo", personId: joseph.id })
    setRecord(next)
  }

  async function notify() {
    if (!record) return
    const next = await saveDemoDeathPronouncement({ ...record, nextOfKinNotified: true })
    await appendTimelineEvent({ type: "next_of_kin_notified", personId: record.personId, title: "Next of kin notified", summary: "Notification recorded" })
    setRecord(next)
  }

  async function handoff() {
    if (!record) return
    const next = await saveDemoMortuaryBody({
      id: crypto.randomUUID(),
      pronouncementId: record.id,
      bodyNumber: "MB-DEMO-JOSEPH",
      tagCode: "TAG-MB-DEMO-JOSEPH",
      status: "received",
    })
    await appendTimelineEvent({ type: "mortuary_transfer", personId: record.personId, title: "Mortuary transfer", summary: next.bodyNumber })
    await appendAuditEvent({ type: "mortuary_received", actorId: "admin-demo", bodyNumber: next.bodyNumber })
    setBody(next)
  }

  return (
    <DemoShell title="Death pronouncement demo" description="Synthetic demonstration data. Separate from the Golden Journey patient." requiresRole={["doctor", "admin"]}>
      <div className="demo-card p-6 space-y-4">
        <p className="rounded bg-amber-500/10 p-3 text-sm">Synthetic demonstration data — Joseph Demo is not Amina Demo.</p>
        <p className="text-sm">Doctor → pronounce death → record time → notify next of kin → generate pronouncement → mortuary handoff → custody.</p>
        <label className="block text-sm">
          Time precision
          <select className="ml-2 rounded border px-2 py-1" value={precision} onChange={(event) => setPrecision(event.target.value as typeof precision)}>
            <option value="EXACT">EXACT</option>
            <option value="ESTIMATED">ESTIMATED</option>
            <option value="UNKNOWN">UNKNOWN</option>
          </select>
        </label>
        {error ? <p className="text-sm text-amber-700">{error}</p> : null}
        <button type="button" className="demo-btn-primary" onClick={() => void pronounce()}>Pronounce death</button>
        {record ? (
          <div className="space-y-2 text-sm">
            <p>Pronouncement recorded with precision {record.precision}.</p>
            <button type="button" className="rounded border px-3 py-2" onClick={() => void notify()}>Notify next of kin</button>
            <button type="button" className="rounded border px-3 py-2" onClick={() => void handoff()}>Mortuary handoff</button>
          </div>
        ) : null}
        {body ? <p className="text-sm">Custody received · {body.bodyNumber} · {body.tagCode}</p> : null}
      </div>
    </DemoShell>
  )
}
