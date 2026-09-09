"use client"

import { useEffect, useState } from "react"

type Mapping = { id: string; device_id: string; analyzer_code: string; analyzer_name: string | null; loinc_code: string | null; active: boolean }

export default function LabMappingsPage() {
  const [mappings, setMappings] = useState<Mapping[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  async function refresh() {
    const response = await fetch("/api/lab/mappings", { cache: "no-store" })
    const data = await response.json() as { mappings?: Mapping[]; error?: string }
    if (!response.ok) throw new Error(data.error ?? "Unable to load analyzer mappings")
    setMappings(data.mappings ?? [])
  }

  useEffect(() => { refresh().catch((err) => setError(err instanceof Error ? err.message : "Unable to load analyzer mappings")) }, [])

  async function disable(id: string) {
    setBusy(id); setError(null)
    try {
      const response = await fetch(`/api/lab/mappings/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ active: false }) })
      const data = await response.json() as { error?: string }
      if (!response.ok) throw new Error(data.error ?? "Unable to disable mapping")
      await refresh()
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to disable mapping") } finally { setBusy(null) }
  }

  return <main className="clinical-page p-6 lg:p-8">
    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-700">Laboratory</p>
    <h1 className="mt-2 font-display text-2xl">Analyzer mappings</h1>
    <p className="mt-2 text-sm text-muted-color">Device-specific analyzer codes mapped to the SYNAPSE catalogue. Changes apply on reprocess.</p>
    {error ? <p role="alert" className="mt-4 text-sm text-red-700">{error}</p> : null}
    <div className="clinical-card mt-6 overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">Analyzer test mappings</caption><thead className="border-b border-subtle text-xs text-muted-color"><tr><th className="px-4 py-3">Device</th><th className="px-4 py-3">Analyzer code</th><th className="px-4 py-3">SYNAPSE test</th><th className="px-4 py-3">State</th><th className="px-4 py-3">Action</th></tr></thead><tbody>{mappings.map((mapping) => <tr key={mapping.id} className="border-b border-subtle/60"><td className="px-4 py-3 font-mono text-xs">{mapping.device_id}</td><td className="px-4 py-3">{mapping.analyzer_code}<p className="text-xs text-muted-color">{mapping.analyzer_name ?? ""}</p></td><td className="px-4 py-3">{mapping.loinc_code ?? "Not mapped"}</td><td className="px-4 py-3 text-xs">{mapping.active ? "ACTIVE" : "DISABLED"}</td><td className="px-4 py-3">{mapping.active ? <button type="button" disabled={busy === mapping.id} onClick={() => disable(mapping.id)} className="min-h-11 rounded-lg border border-edge px-3 py-2 text-xs">Disable</button> : null}</td></tr>)}</tbody></table>{mappings.length === 0 ? <p className="p-8 text-sm text-muted-color">No analyzer mappings configured.</p> : null}</div>
  </main>
}
