'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'

const LINKS = [
  { href: 'notes', title: 'Clinical write-up', body: 'HPI, PMH, meds, allergies, ROS, exam, assessment, plan' },
  { href: 'orders', title: 'Orders', body: 'Labs, imaging, and other investigations' },
  { href: 'history', title: 'Patient history', body: 'Prior encounters and longitudinal context' },
  { href: 'scoring', title: 'Scores', body: 'Clinical scores and risk tools' },
  { href: 'disposition', title: 'Disposition', body: 'Local/external pharmacy, follow-up, referral, complete' },
  { href: 'sign', title: 'Sign encounter', body: 'Lock the note after review' },
]

export default function EncounterPage() {
  const params = useParams<{ id: string }>()
  const id = params.id

  return (
    <main className="clinical-page mx-auto max-w-3xl px-4 py-8">
      <h1 className="font-display text-2xl text-primary-color">Encounter</h1>
      <p className="mt-1 text-sm text-muted-color font-mono">{id}</p>
      <div className="mt-8 grid gap-3">
        {LINKS.map((item) => (
          <Link
            key={item.href}
            href={`/encounter/${id}/${item.href}`}
            className="clinical-card block p-4 transition hover:border-strong"
          >
            <div className="text-sm font-medium text-primary-color">{item.title}</div>
            <div className="mt-1 text-sm text-secondary-color">{item.body}</div>
          </Link>
        ))}
      </div>
    </main>
  )
}
