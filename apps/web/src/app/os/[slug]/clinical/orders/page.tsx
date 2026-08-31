'use client'

import { Suspense } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { EncounterOrdersPanel } from '../../../../../components/clinical/EncounterOrdersPanel'

function OrdersInner() {
  const params = useParams<{ slug: string }>()
  const searchParams = useSearchParams()
  const encounterId = searchParams.get('encounterId') ?? ''
  const patientId = searchParams.get('patientId')

  return (
    <EncounterOrdersPanel slug={params.slug} encounterId={encounterId} patientId={patientId} />
  )
}

export default function ClinicalOrdersPage() {
  return (
    <main className="clinical-page mx-auto max-w-4xl p-6">
      <Suspense fallback={<p className="text-sm text-muted-color">Loading…</p>}>
        <OrdersInner />
      </Suspense>
    </main>
  )
}
