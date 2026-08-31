'use client'

import { useParams } from 'next/navigation'
import { OpdQueuePanel } from '../../../../../components/clinical/OpdQueuePanel'

export default function ClinicalQueuePage() {
  const params = useParams<{ slug: string }>()
  return (
    <main className="clinical-page mx-auto max-w-4xl p-6">
      <OpdQueuePanel slug={params.slug} />
    </main>
  )
}
