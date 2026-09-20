"use client"

import { useState } from "react"

type Analysis = {
  summary?: string
  abnormal_findings?: string[]
  critical_findings?: string[]
  possible_relevance?: string
  suggested_follow_up?: string
  confidence?: number
}

export function LabAiAnalysis({ resultId, stagingId }: { resultId?: string; stagingId?: string }) {
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [label, setLabel] = useState<string | null>(null)
  const [unavailable, setUnavailable] = useState(false)
  const [busy, setBusy] = useState(false)

  async function run() {
    setBusy(true)
    setUnavailable(false)
    try {
      const response = await fetch("/api/lab/interpretation", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ resultId, stagingId }),
      })
      const data = await response.json().catch(() => ({})) as { analysis?: Analysis; label?: string; unavailable?: boolean; error?: string }
      if (data.unavailable || !response.ok) {
        setUnavailable(true)
        setLabel(data.label ?? "AI assistance unavailable")
        setAnalysis(null)
        return
      }
      setAnalysis(data.analysis ?? null)
      setLabel(data.label ?? "AI decision support only. Does not verify or release results.")
    } catch {
      setUnavailable(true)
      setLabel("AI assistance unavailable")
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mt-4 rounded-xl border border-violet-500/30 bg-violet-500/5 p-4" aria-label="Synapse AI — Result Analysis">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-violet-200">Synapse AI — Result Analysis</h2>
          <p className="mt-1 text-xs text-muted-color">AI decision support only. Does not verify or release results.</p>
        </div>
        <button type="button" disabled={busy} onClick={run} className="rounded-lg border border-violet-400/40 px-3 py-1.5 text-xs font-medium text-violet-100 disabled:opacity-50">
          {busy ? "Analysing…" : "Analyse"}
        </button>
      </div>
      {unavailable ? <p className="mt-3 text-sm text-amber-300">{label ?? "AI assistance unavailable"}</p> : null}
      {analysis ? (
        <div className="mt-3 space-y-2 text-sm">
          <p>{analysis.summary}</p>
          {analysis.possible_relevance ? <p className="text-muted-color">{analysis.possible_relevance}</p> : null}
          {analysis.critical_findings?.length ? <p className="text-red-300">Critical findings: {analysis.critical_findings.join("; ")}</p> : null}
          {analysis.abnormal_findings?.length ? <p>Abnormal findings: {analysis.abnormal_findings.join("; ")}</p> : null}
          {analysis.suggested_follow_up ? <p className="text-xs text-muted-color">{analysis.suggested_follow_up}</p> : null}
          {label ? <p className="text-[11px] uppercase tracking-wide text-violet-300">{label}</p> : null}
        </div>
      ) : null}
    </section>
  )
}
