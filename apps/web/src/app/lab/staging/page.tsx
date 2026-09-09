"use client"

import { useEffect, useState } from "react"

type StagingRow = {
  id: string
  device_id: string | null
  accession_number: string | null
  analyzer_code: string | null
  mapped_test_name: string | null
  value: string | null
  unit: string | null
  status: string
  created_at: string
}

export default function LabStagingPage() {
  const [rows, setRows] = useState<StagingRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  async function refresh() {
    const response = await fetch("/api/lab/staging", { cache: "no-store" })
    const data = await response.json().catch(() => ({})) as { staging?: StagingRow[]; error?: string }
    if (!response.ok) throw new Error(data.error ?? "Unable to load analyzer staging")
    setRows(data.staging ?? [])
  }

  useEffect(() => { refresh().catch((err) => setError(err instanceof Error ? err.message : "Unable to load analyzer staging")) }, [])

  async function act(id: string, action: "accept" | "reject") {
    setBusy(id); setError(null)
    try {
      const body = action === "reject" ? { reason: "Rejected during scientist review" } : undefined
      const response = await fetch(`/api/lab/staging/${id}/${action}`, { method: "POST", headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined })
      const data = await response.json().catch(() => ({})) as { error?: string }
      if (!response.ok) throw new Error(data.error ?? `Could not ${action} staging result`)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Staging action failed")
    } finally { setBusy(null) }
  }

  async function reprocess(id: string) {
    setBusy(id); setError(null)
    try {
      const response = await fetch(`/api/lab/staging/${id}/reprocess`, { method: "POST" })
      const data = await response.json().catch(() => ({})) as { error?: string }
      if (!response.ok) throw new Error(data.error ?? "Could not reprocess staging result")
      await refresh()
    } catch (err) { setError(err instanceof Error ? err.message : "Reprocess failed") } finally { setBusy(null) }
  }

  async function matchAccession(id: string) {
    const accession = window.prompt("Enter the valid accession to reconcile")?.trim()
    if (!accession) return
    setBusy(id); setError(null)
    try {
      const response = await fetch(`/api/lab/staging/${id}/match-accession`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ accessionNumber: accession, confirm: window.confirm(`Confirm accession ${accession}? Verify two patient identifiers before confirming.`) }) })
      const data = await response.json().catch(() => ({})) as { error?: string }
      if (!response.ok) throw new Error(data.error ?? "Could not match accession")
      await refresh()
    } catch (err) { setError(err instanceof Error ? err.message : "Accession reconciliation failed") } finally { setBusy(null) }
  }

  return (
    <main className="clinical-page p-6 lg:p-8">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-700">Laboratory</p>
        <h1 className="mt-2 font-display text-2xl">Analyzer staging</h1>
        <p className="mt-2 text-sm text-muted-color">Review mapped analyzer observations before they enter the clinical result workflow.</p>
      </div>
      {error ? <p role="alert" className="mb-4 text-sm text-red-700">{error}</p> : null}
      <div className="overflow-x-auto clinical-card">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Analyzer results awaiting scientist review</caption>
          <thead className="border-b border-subtle text-xs text-muted-color"><tr><th className="px-4 py-3">Accession</th><th className="px-4 py-3">Test</th><th className="px-4 py-3">Result</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Actions</th></tr></thead>
          <tbody>
            {rows.map((row) => <tr key={row.id} className="border-b border-subtle/60"><td className="px-4 py-3 font-mono text-xs">{row.accession_number ?? "Unmatched"}</td><td className="px-4 py-3">{row.mapped_test_name ?? row.analyzer_code ?? "Unmapped"}<p className="text-xs text-muted-color">{row.device_id ?? "Device unavailable"}</p></td><td className="px-4 py-3 font-medium">{row.value ?? "—"} {row.unit ?? ""}</td><td className="px-4 py-3 text-xs font-semibold">{row.status}</td><td className="px-4 py-3"><div className="flex flex-wrap gap-2">{row.status === "READY_FOR_REVIEW" ? <><button type="button" disabled={busy === row.id} onClick={() => act(row.id, "accept")} className="min-h-11 rounded-lg bg-violet-700 px-3 py-2 text-xs font-semibold text-white">Accept result</button><button type="button" disabled={busy === row.id} onClick={() => act(row.id, "reject")} className="min-h-11 rounded-lg border border-edge px-3 py-2 text-xs font-medium">Reject</button></> : row.status === "UNMAPPED" ? <button type="button" disabled={busy === row.id} onClick={() => reprocess(row.id)} className="min-h-11 rounded-lg border border-edge px-3 py-2 text-xs font-medium">Reprocess mapping</button> : row.status === "UNMATCHED" ? <button type="button" disabled={busy === row.id} onClick={() => matchAccession(row.id)} className="min-h-11 rounded-lg border border-edge px-3 py-2 text-xs font-medium">Match accession</button> : <span className="text-xs text-muted-color">No action</span>}</div></td></tr>)}
          </tbody>
        </table>
        {rows.length === 0 ? <p className="p-8 text-sm text-muted-color">No analyzer observations in staging.</p> : null}
      </div>
    </main>
  )
}