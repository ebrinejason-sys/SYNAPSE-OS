'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { EncounterOrdersPanel } from '../../../../components/clinical/EncounterOrdersPanel'
import { useEffect, useState } from 'react'

export default function EncounterOrdersPage() {
  const params = useParams<{ id: string }>()
  const [slug, setSlug] = useState<string>('')

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) return
        const data = await res.json()
        setSlug(data.user?.tenantSlug ?? '')
      })
      .catch(() => undefined)
  }, [])

  return (
    <main className="clinical-page mx-auto max-w-4xl p-6">
      <p className="mb-4 text-sm">
        <Link href={`/encounter/${params.id}`} className="text-muted-color hover:text-primary-color">
          ← Encounter
        </Link>
      </p>
      <EncounterOrdersPanel slug={slug || 'facility'} encounterId={params.id} />
    </main>
  )
}
