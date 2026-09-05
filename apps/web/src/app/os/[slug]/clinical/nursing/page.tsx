'use client'

import { useParams } from 'next/navigation'
import { NursingBoardPanel } from '../../../../../components/clinical/NursingBoardPanel'

export default function ClinicalNursingPage() {
  const params = useParams<{ slug: string }>()
  return (
    <main className="clinical-page mx-auto max-w-5xl p-6">
      <NursingBoardPanel slug={params.slug} />
    </main>
  )
}