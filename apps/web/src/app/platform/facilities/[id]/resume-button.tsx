"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export function FacilityResumeButton({ runId }: { runId: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={busy}
        className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-100 disabled:opacity-60"
        onClick={async () => {
          setBusy(true)
          setMessage("")
          try {
            const res = await fetch("/api/platform/facilities", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "resume", runId }),
            })
            const payload = await res.json()
            if (!res.ok || !payload.ok) {
              setMessage(payload.failureReason || payload.error || "Resume failed")
            } else {
              setMessage(`Resumed → ${payload.status}`)
              router.refresh()
            }
          } catch (err) {
            setMessage(err instanceof Error ? err.message : "Resume failed")
          } finally {
            setBusy(false)
          }
        }}
      >
        {busy ? "Resuming…" : "Resume provisioning / Retry failed step"}
      </button>
      {message ? <p className="text-xs text-slate-400">{message}</p> : null}
    </div>
  )
}
