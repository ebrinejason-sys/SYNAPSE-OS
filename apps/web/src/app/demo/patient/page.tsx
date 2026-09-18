"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { DemoShell } from "../../../components/demo/DemoShell"
import { getPersons, initializePlayground } from "../../../lib/demo/browser-repository"
import type { DemoPerson } from "../../../lib/demo/entities"
import { DEMO_ROUTES } from "../../../lib/demo/paths"

export default function PatientDemoPage() {
  const [people, setPeople] = useState<DemoPerson[]>([])
  const [query, setQuery] = useState("")
  const [ready, setReady] = useState(false)

  useEffect(() => {
    initializePlayground()
      .then(() => getPersons())
      .then((rows) => {
        setPeople(rows)
        setReady(true)
      })
      .catch(() => setReady(true))
  }, [])

  const filtered = people.filter((person) => {
    const q = query.trim().toLowerCase()
    if (!q) return true
    return [person.name, person.synapseId, person.phone, person.address].some((value) =>
      String(value ?? "").toLowerCase().includes(q),
    )
  })

  return (
    <DemoShell title="Patients" requiresRole={["reception", "nurse", "doctor", "admin", "cashier"]}>
      <div className="space-y-4">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, Synapse ID, or phone"
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
        />
        {!ready ? <p className="text-sm text-muted-foreground">Loading synthetic patients…</p> : null}
        {filtered.map((person) => (
          <div key={person.id} className="rounded-lg border bg-card p-4">
            <p className="font-semibold">{person.name}</p>
            <p className="text-sm text-muted-foreground">{person.synapseId} · {person.sex} · {person.phone}</p>
            <p className="mt-1 text-xs text-orange-600">Synthetic identity — not a real person.</p>
            <div className="mt-3 flex flex-wrap gap-2 text-sm">
              <Link href={DEMO_ROUTES.reception} className="rounded border px-3 py-1 hover:bg-accent">Start visit</Link>
              <Link href={DEMO_ROUTES.timeline} className="rounded border px-3 py-1 hover:bg-accent">Timeline</Link>
            </div>
          </div>
        ))}
        {ready && filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">No matching synthetic patients. Try “Amina” or reset the playground.</p>
        ) : null}
      </div>
    </DemoShell>
  )
}
