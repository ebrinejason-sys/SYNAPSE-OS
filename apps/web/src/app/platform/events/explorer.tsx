"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { PlatformPageHeader } from "../_components/platform-page-header"

type EventRow = {
  event_id: string
  event_type: string
  source: string
  timestamp: string
  correlation_id: string
  causation_id?: string | null
  patient_id?: string | null
  status?: string
  retry_count?: number
}

export default function EventExplorerPage() {
  const params = useSearchParams()
  const [events, setEvents] = useState<EventRow[]>([])
  const [correlationId, setCorrelationId] = useState(params.get("correlationId") ?? "")
  const [error, setError] = useState<string | null>(null)

  async function load(id = correlationId) {
    const qs = id ? `?correlationId=${encodeURIComponent(id)}` : ""
    const res = await fetch(`/api/platform/events${qs}`, { cache: "no-store" })
    if (!res.ok) {
      setError("Unable to load events")
      return
    }
    const data = (await res.json()) as { events: EventRow[] }
    setEvents(data.events)
    setError(null)
  }

  useEffect(() => {
    load().catch(() => setError("Unable to load events"))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="space-y-6">
      <PlatformPageHeader
        eyebrow="Event observability"
        title="Synapse Exchange explorer"
        description="Inspect versioned domain events. Patient identifiers are masked. Correlation traces the clinical → lab → pharmacy chain."
      />
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          load()
        }}
      >
        <input
          value={correlationId}
          onChange={(event) => setCorrelationId(event.target.value)}
          placeholder="correlation_id"
          className="min-w-[240px] flex-1 rounded-xl border border-subtle bg-surface px-3 py-2 text-sm text-primary-color"
        />
        <button type="submit" className="rounded-xl bg-[#F97316] px-4 py-2 text-sm font-semibold text-black">
          Trace
        </button>
      </form>
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      <ol className="space-y-2">
        {events.length === 0 ? <p className="text-sm text-muted-color">No events yet. Run a simulation scenario first.</p> : null}
        {events.map((event, index) => (
          <li key={event.event_id} className="rounded-xl border border-subtle bg-surface px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-primary-color">
                {index + 1}. {event.event_type}
              </p>
              <p className="text-xs text-muted-color">{event.source}</p>
            </div>
            <p className="mt-1 text-xs text-muted-color">
              {event.timestamp} · patient {event.patient_id ?? "—"} · retries {event.retry_count ?? 0} · {event.status ?? "pending"}
            </p>
          </li>
        ))}
      </ol>
    </div>
  )
}
