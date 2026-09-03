"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

type ResultRow = {
  id: string
  lab_order_id: string
  test_name: string
  loinc_code: string | null
  result_value: string
  unit: string | null
  reference_range: string | null
  status: string
  is_critical: boolean
  is_abnormal: boolean
  abnormal_flag: string | null
  analyzer: string | null
  result_source: string | null
  verified_at: string | null
  accession_number?: string | null
  patient_name?: string | null
}

export default function LabResultsPage() {
  const [rows, setRows] = useState<ResultRow[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/lab/results", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error("unauthorized")
        const data = (await res.json()) as { results: ResultRow[] }
        setRows(data.results ?? [])
      })
      .catch(() => setError("Sign in as lab staff to load results."))
  }, [])

  return (
    <main className="clinical-page p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl">Results</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-color">
            Durable results from manual entry or analyzer staging. Verified results require amendment to change.
          </p>
        </div>
        <div className="flex gap-3 text-sm">
          <Link href="/lab/verify" className="text-[#E8B84B] hover:underline">
            Verification queue
          </Link>
          <Link href="/lab/orders" className="text-[#E8B84B] hover:underline">
            Worklist
          </Link>
        </div>
      </div>

      {error ? <p className="mt-4 text-sm text-amber-300">{error}</p> : null}

      <div className="mt-8 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-subtle text-xs text-muted-color">
            <tr>
              <th className="px-2 py-2">Patient / Accession</th>
              <th className="px-2 py-2">Test</th>
              <th className="px-2 py-2">Value</th>
              <th className="px-2 py-2">Flags</th>
              <th className="px-2 py-2">Source</th>
              <th className="px-2 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-subtle/50">
                <td className="px-2 py-3">
                  <p>{r.patient_name ?? "—"}</p>
                  <p className="font-mono text-xs text-amber-200">{r.accession_number ?? "—"}</p>
                </td>
                <td className="px-2 py-3">
                  {r.test_name}
                  <p className="text-xs text-muted-color">{r.loinc_code}</p>
                </td>
                <td className="px-2 py-3 font-medium">
                  {r.result_value} {r.unit}
                  <p className="text-xs text-muted-color">{r.reference_range}</p>
                </td>
                <td className="px-2 py-3">
                  {r.is_critical ? (
                    <span className="rounded border border-red-500/40 bg-red-500/10 px-1.5 py-0.5 text-[10px] font-bold text-red-300">
                      CRITICAL
                    </span>
                  ) : r.is_abnormal ? (
                    <span className="rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
                      {r.abnormal_flag ?? "ABN"}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-color">{r.abnormal_flag ?? "N"}</span>
                  )}
                </td>
                <td className="px-2 py-3 text-xs">
                  {r.result_source ?? "—"}
                  {r.analyzer ? <p className="text-muted-color">{r.analyzer}</p> : null}
                </td>
                <td className="px-2 py-3 text-xs uppercase">{r.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && !error ? (
          <p className="mt-6 text-sm text-muted-color">No durable results yet.</p>
        ) : null}
      </div>
    </main>
  )
}
