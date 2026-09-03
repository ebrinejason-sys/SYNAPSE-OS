"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

type Device = {
  id: string
  name: string
  manufacturer: string | null
  model: string | null
  connection_type: string
  protocol: string
  validation_status: string
  health_status: string
  active: boolean
  last_seen_at: string | null
  last_message_at: string | null
}

export default function LabInstrumentsPage() {
  const [devices, setDevices] = useState<Device[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/lab/instruments", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error("load_failed")
        const data = (await res.json()) as { devices: Device[] }
        setDevices(data.devices ?? [])
      })
      .catch(() => setError("Unable to load instruments. Apply lab device migration if tables are missing."))
  }, [])

  return (
    <main className="clinical-page p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl">Instruments</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-color">
            Analyzer registry and health. Lab Edge owns serial/TCP connections; cloud never holds a direct RS-232
            link. New devices start as CONFIGURED → VALIDATION before ACTIVE.
          </p>
        </div>
        <Link href="/lab/orders" className="text-sm text-[#E8B84B] hover:underline">
          ← Worklist
        </Link>
      </div>

      {error ? <p className="mt-4 text-sm text-amber-300">{error}</p> : null}

      {devices.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-subtle p-6 text-sm text-muted-color">
          <p>No instruments registered yet.</p>
          <p className="mt-2">
            Wave 2: deploy <code className="text-amber-200">apps/lab-edge</code> on the laboratory LAN, register a
            device, then use Add Instrument with protocol profile (ASTM / HL7 MLLP / serial).
          </p>
        </div>
      ) : (
        <ul className="mt-8 space-y-3">
          {devices.map((d) => (
            <li key={d.id} className="rounded-2xl border border-subtle bg-surface p-4">
              <div className="flex flex-wrap justify-between gap-2">
                <div>
                  <p className="font-medium">{d.name}</p>
                  <p className="text-xs text-muted-color">
                    {[d.manufacturer, d.model].filter(Boolean).join(" · ") || "—"} · {d.connection_type} ·{" "}
                    {d.protocol}
                  </p>
                </div>
                <div className="text-right text-xs">
                  <p className={d.active ? "text-emerald-300" : "text-slate-400"}>
                    {d.validation_status} · {d.health_status}
                  </p>
                  <p className="text-muted-color">
                    Last message {d.last_message_at ? new Date(d.last_message_at).toLocaleString() : "never"}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
