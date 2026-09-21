'use client'

import { useCallback, useEffect, useState } from 'react'

type Body = {
  id: string
  status: string
  identity: { bodyNumber: string; tagCode: string; unknownPerson: boolean }
  storage?: { slotCode?: string } | null
}

export default function MortuaryPage() {
  const [bodies, setBodies] = useState<Body[]>([])
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await fetch('/api/mortuary/bodies', { credentials: 'include' })
    if (!res.ok) {
      setError('Mortuary access requires register/read capability.')
      return
    }
    const json = await res.json()
    setBodies(json.bodies ?? [])
    setError(null)
  }, [])

  useEffect(() => {
    load().catch(() => setError('Unable to load mortuary register'))
  }, [load])

  return (
    <main className="clinical-page mx-auto max-w-5xl p-6">
      <h1 className="font-display text-2xl">Mortuary register</h1>
      <p className="mt-1 text-sm text-muted-color">Identification uses body number and tag, not name alone. Release requires authorization.</p>
      {error ? <p className="mt-4 text-sm text-amber-300">{error}</p> : null}
      <ul className="mt-6 space-y-3">
        {bodies.map((body) => (
          <li key={body.id} className="clinical-card p-4">
            <p className="font-medium">{body.identity.bodyNumber}</p>
            <p className="text-xs text-muted-color">Tag {body.identity.tagCode} · {body.status}{body.storage?.slotCode ? ` · slot ${body.storage.slotCode}` : ''}</p>
            {body.identity.unknownPerson ? <p className="text-xs text-amber-300">Temporary identity — reconcile later</p> : null}
          </li>
        ))}
      </ul>
    </main>
  )
}
