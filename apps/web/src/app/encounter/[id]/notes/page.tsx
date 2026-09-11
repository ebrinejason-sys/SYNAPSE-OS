'use client'

import { useParams } from 'next/navigation'
import { ClinicalWriteupPanel } from '@/components/clinical/ClinicalWriteupPanel'

export default function EncounterNotesPage() {
  const params = useParams<{ id: string }>()
  const encounterId = params.id

  return (
    <main className="clinical-page mx-auto max-w-3xl px-4 py-8">
      <ClinicalWriteupPanel encounterId={encounterId} backHref={`/encounter/${encounterId}`} />
    </main>
  )
}
