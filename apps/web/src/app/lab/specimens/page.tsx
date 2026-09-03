"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

type SpecimenRow = {
  id: string
  accession_number: string
  barcode: string | null
  specimen_type: string | null
  status: string
  collected_at: string | null
  received_at: string | null
  lab_order_id: string | null
  patients?: { first_name?: string; last_name?: string; mrn?: string } | null
}

export default function LabSpecimensPage() {
  const [rows, setRows] = useState<SpecimenRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [scan, setScan] = useState("")

  async function refresh() {
    const res = await fetch("/api/lab/specimens", { cache: "no-store" })
    if (!res.ok) {
      setError("Sign in as lab staff to load specimens.")
      return
    }
    const data = (await res.json()) as { specimens: SpecimenRow[] }
    setRows(data.specimens ?? [])
    setError(null)
  }

  useEffect(() => {
    refresh().catch(() => setError("Unable to load specimens"))
  }, [])

  const filtered = scan.trim()
    ? rows.filter(
        (r) =>
          r.accession_number.toLowerCase().includes(scan.toLowerCase()) ||
          (r.barcode ?? "").toLowerCase().includes(scan.toLowerCase()),
      )
    : rows

  return (
    <main className="clinical-page p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl">Specimens</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-color">
            Accession, barcode, receipt, and rejection. Scan Code128 / keyboard-wedge barcode into the field below.
          </p>
        </div>
        <Link href="/lab/orders" className="text-sm text-[#E8B84B] hover:underline">
          ← Worklist
        </Link>
      </div>

      <label className="mt-6 block max-w-md text-xs text-muted-color">
        Scan / search accession
        <input
          value={scan}
          onChange={(e) => setScan(e.target.value)}
          className="mt-1 w-full rounded-lg border border-edge bg-surface px-3 py-2 font-mono text-sm"
          placeholder="LAB-20260902-000123"
          autoFocus
        />
      </label>

      {error ? <p className="mt-4 text-sm text-amber-300">{error}</p> : null}

      {filtered.length === 0 ? (
        <p className="mt-8 text-sm text-muted-color">No specimens yet. Collect from the worklist.</p>
      ) : (
        <ul className="mt-8 space-y-3">
          {filtered.map((s) => {
            const name = s.patients
              ? [s.patients.first_name, s.patients.last_name].filter(Boolean).join(" ")
              : "—"
            return (
              <li key={s.id} className="rounded-2xl border border-subtle bg-surface p-4">
                <div className="flex flex-wrap justify-between gap-2">
                  <div>
                    <p className="font-mono text-sm text-amber-200">{s.accession_number}</p>
                    <p className="mt-1 text-sm">
                      {name} · {s.specimen_type ?? "specimen"} · {s.status}
                    </p>
                    <p className="text-xs text-muted-color">
                      Collected {s.collected_at ? new Date(s.collected_at).toLocaleString() : "—"}
                      {s.received_at ? ` · Received ${new Date(s.received_at).toLocaleString()}` : ""}
                    </p>
                  </div>
                  {s.lab_order_id ? (
                    <Link href="/lab/orders" className="text-xs text-[#E8B84B] hover:underline">
                      Open order
                    </Link>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}
