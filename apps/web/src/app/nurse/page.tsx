'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { NursingBoardPanel } from '../../components/clinical/NursingBoardPanel'
import { nurseWorkspaceTabs } from '../../lib/production-navigation'

export default function NurseWorkspacePage() {
  const [slug, setSlug] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) {
          setError('Sign in as nursing staff to open the Nursing workspace.')
          setReady(true)
          return
        }
        const data = await res.json()
        setSlug(data.user?.tenantSlug ?? null)
        setReady(true)
      })
      .catch(() => {
        setError('Sign in as nursing staff to open the Nursing workspace.')
        setReady(true)
      })
  }, [])

  const tabs = nurseWorkspaceTabs(slug)

  return (
    <main className="clinical-page mx-auto max-w-5xl p-6">
      <h1 className="font-display text-2xl text-primary-color">Nursing workspace</h1>
      <p className="mt-1 text-sm text-muted-color">
        One nursing workspace: board, vitals, and ward. Placeholder nurse pages are not in production navigation.
      </p>
      <nav className="mt-4 flex flex-wrap gap-2" aria-label="Nursing modules">
        {tabs.map((tab) => (
          <Link
            key={tab.name}
            href={tab.href}
            className="rounded-lg border border-border px-3 py-1.5 text-sm text-secondary-color hover:text-primary-color"
          >
            {tab.name}
          </Link>
        ))}
      </nav>
      {!ready ? <p className="mt-6 text-sm text-muted-color">Loading…</p> : null}
      {error ? <p className="mt-6 text-sm text-muted-color">{error}</p> : null}
      {slug ? (
        <div className="mt-6">
          <NursingBoardPanel slug={slug} />
        </div>
      ) : null}
    </main>
  )
}
