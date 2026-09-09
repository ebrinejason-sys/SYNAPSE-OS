'use client'

import { WorkQueuePanel } from '../../../../../components/clinical/WorkQueuePanel'

export default async function ClinicalTasksPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return (
    <main className="clinical-page mx-auto max-w-4xl p-6">
      <WorkQueuePanel tenantSlug={slug} />
    </main>
  )
}
