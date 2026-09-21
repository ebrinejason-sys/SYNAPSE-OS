"use client"

import { useEffect, useState } from "react"

type Mapping = {
  id: string
  device_id: string
  analyzer_code: string
  analyzer_name: string | null
  loinc_code: string | null
  unit: string | null
  active: boolean
}

export default function LabMappingsPage() {
  const [mappings, setMappings] = useState<Mapping[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [deviceId, setDeviceId] = useState("")
  const [analyzerCode, setAnalyzerCode] = useState("")
  const [analyzerName, setAnalyzerName] = useState("")
  const [loincCode, setLoincCode] = useState("")
  const [unit, setUnit] = useState("")

  async function refresh() {
    const response = await fetch("/api/lab/mappings", { cache: "no-store" })
    const data = await response.json() as { mappings?: Mapping[]; error?: string }
    if (!response.ok) throw new Error(data.error ?? "Unable to load analyzer mappings")
    setMappings(data.mappings ?? [])
  }

  useEffect(() => { refresh().catch((err) => setError(err instanceof Error ? err.message : "Unable to load analyzer mappings")) }, [])

  async function createMapping() {
    setBusy("create"); setError(null)
    try {
      const response = await fetch("/api/lab/mappings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ deviceId, analyzerCode, analyzerName, loincCode, unit }),
      })
      const data = await response.json() as { error?: string }
      if (!response.ok) throw new Error(data.error ?? "Unable to create mapping")
      setAnalyzerCode(""); setAnalyzerName(""); setLoincCode(""); setUnit("")
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create mapping")
    } finally { setBusy(null) }
  }

  async function disable(id: string) {
    setBusy(id); setError(null)
    try {
      const response = await fetch(`/api/lab/mappings/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ active: false }) })
      const data = await response.json() as { error?: string }
      if (!response.ok) throw new Error(data.error ?? "Unable to disable mapping")
      await refresh()
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to disable mapping") } finally { setBusy(null) }
  }

  const mapped = mappings.filter((row) => row.active && row.loinc_code).length
  const unmapped = mappings.filter((row) => row.active && !row.loinc_code).length

  return <main className="clinical-page p-6 lg:p-8">
    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-700">Laboratory</p>
    <h1 className="mt-2 font-display text-2xl">Analyzer mappings</h1>
    <p className="mt-2 text-sm text-muted-color">Humans approve analyzer code → SYNAPSE test / LOINC mappings. AI may later suggest, but cannot create the final mapping.</p>
    <p className="mt-2 text-xs text-muted-color">Mapped analyzer codes: {mapped} · Unmapped: {unmapped} · Coverage: {mapped + unmapped === 0 ? 0 : Math.round((mapped / (mapped + unmapped)) * 100)}%</p>
    {error ? <p role="alert" className="mt-4 text-sm text-red-700">{error}</p> : null}
    <form className="clinical-card mt-6 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5" onSubmit={(event) => { event.preventDefault(); void createMapping() }}>
      <label className="text-xs">Device ID<input required value={deviceId} onChange={(e) => setDeviceId(e.target.value)} className="mt-1 w-full rounded border border-subtle bg-elevated px-2 py-1 font-mono" /></label>
      <label className="text-xs">Analyzer code<input required value={analyzerCode} onChange={(e) => setAnalyzerCode(e.target.value)} className="mt-1 w-full rounded border border-subtle bg-elevated px-2 py-1" placeholder="WBC" /></label>
      <label className="text-xs">Display name<input value={analyzerName} onChange={(e) => setAnalyzerName(e.target.value)} className="mt-1 w-full rounded border border-subtle bg-elevated px-2 py-1" placeholder="White blood cells" /></label>
      <label className="text-xs">LOINC<input required value={loincCode} onChange={(e) => setLoincCode(e.target.value)} className="mt-1 w-full rounded border border-subtle bg-elevated px-2 py-1" placeholder="6690-2" /></label>
      <label className="text-xs">Canonical unit<input value={unit} onChange={(e) => setUnit(e.target.value)} className="mt-1 w-full rounded border border-subtle bg-elevated px-2 py-1" placeholder="10*9/L" /></label>
      <div className="sm:col-span-2 lg:col-span-5">
        <button type="submit" disabled={busy === "create"} className="rounded-lg bg-violet-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Approve mapping</button>
      </div>
    </form>
    <div className="clinical-card mt-6 overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">Analyzer test mappings</caption><thead className="border-b border-subtle text-xs text-muted-color"><tr><th className="px-4 py-3">Device</th><th className="px-4 py-3">Analyzer code</th><th className="px-4 py-3">SYNAPSE test / LOINC</th><th className="px-4 py-3">Unit</th><th className="px-4 py-3">State</th><th className="px-4 py-3">Action</th></tr></thead><tbody>{mappings.map((mapping) => <tr key={mapping.id} className="border-b border-subtle/60"><td className="px-4 py-3 font-mono text-xs">{mapping.device_id}</td><td className="px-4 py-3">{mapping.analyzer_code}<p className="text-xs text-muted-color">{mapping.analyzer_name ?? ""}</p></td><td className="px-4 py-3">{mapping.loinc_code ?? "Not mapped"}</td><td className="px-4 py-3">{mapping.unit ?? "—"}</td><td className="px-4 py-3 text-xs">{mapping.active ? "ACTIVE" : "DISABLED"}</td><td className="px-4 py-3">{mapping.active ? <button type="button" disabled={busy === mapping.id} onClick={() => disable(mapping.id)} className="min-h-11 rounded-lg border border-edge px-3 py-2 text-xs">Disable</button> : null}</td></tr>)}</tbody></table>{mappings.length === 0 ? <p className="p-8 text-sm text-muted-color">No analyzer mappings configured.</p> : null}</div>
  </main>
}
