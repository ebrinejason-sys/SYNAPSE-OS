'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

type TimelineEvent = {
  id: string
  event_type: string
  title: string
  summary: string | null
  event_date: string
  severity: string | null
}

export default function EncounterHistoryPage() {
  const params = useParams<{ id: string }>()
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/hospital/timeline/encounter/${params.id}`, { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) throw new Error('Unable to load encounter timeline.')
        const body = await res.json()
        setEvents(body.events ?? [])
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Unable to load encounter timeline.')
      })
  }, [params.id])

  return (
    <main className="clinical-page mx-auto max-w-3xl p-6">
      <p className="mb-4 text-sm">
        <Link href={`/encounter/${params.id}`} className="text-muted-color hover:text-primary-color">
          ← Encounter
        </Link>
      </p>
      <h1 className="font-display text-2xl text-primary-color">Encounter timeline</h1>
      {error ? <p className="mt-4 text-sm text-muted-color">{error}</p> : null}
      <ol className="mt-6 space-y-3">
        {events.map((event) => (
          <li key={event.id} className="clinical-card p-4">
            <p className="text-sm font-medium text-primary-color">{event.title}</p>
            <p className="mt-1 text-xs text-muted-color">
              {event.event_type} · {new Date(event.event_date).toLocaleString()}
            </p>
            {event.summary ? <p className="mt-2 text-sm text-secondary-color">{event.summary}</p> : null}
          </li>
        ))}
      </ol>
      {!error && events.length === 0 ? (
        <p className="mt-6 text-sm text-muted-color">No timeline events recorded for this encounter yet.</p>
      ) : null}
    </main>
  )
}
