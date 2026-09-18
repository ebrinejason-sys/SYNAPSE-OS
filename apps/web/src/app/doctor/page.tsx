'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { OpdQueuePanel } from '../../components/clinical/OpdQueuePanel'
import { doctorWorkspaceTabs } from '../../lib/production-navigation'

type MeUser = { tenantSlug?: string; role?: string; fullName?: string }

export default function DoctorWorkspacePage() {
  const [slug, setSlug] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) {
          setError('Sign in as hospital clinical staff to open the Doctor workspace.')
          setReady(true)
          return
        }
        const data = (await res.json()) as { user?: MeUser }
        setSlug(data.user?.tenantSlug ?? null)
        setReady(true)
      })
      .catch(() => {
        setError('Sign in as hospital clinical staff to open the Doctor workspace.')
        setReady(true)
      })
  }, [])

  const tabs = doctorWorkspaceTabs(slug)

  return (
    <main className="clinical-page mx-auto max-w-5xl p-6">
      <h1 className="font-display text-2xl text-primary-color">Doctor workspace</h1>
      <p className="mt-1 text-sm text-muted-color">
        One clinical workspace: queue, encounter, orders, billing, and timeline. Specialty modules are not production navigation.
      </p>
      <nav className="mt-4 flex flex-wrap gap-2" aria-label="Doctor modules">
        {tabs.map((tab) => (
          <Link
            key={tab.name}
            href={tab.href}
            className="rounded-lg border border-border px-3 py-1.5 text-sm text-secondary-color hover:text-primary-color"
          >
            {tab.name}
          </Link>
        ))}
        {slug ? (
          <Link
            href={`/os/${slug}/encounters/new`}
            className="rounded-lg bg-[#F97316] px-3 py-1.5 text-sm font-medium text-black"
          >
            Start encounter
          </Link>
        ) : null}
      </nav>
      {!ready ? <p className="mt-6 text-sm text-muted-color">Loading…</p> : null}
      {error ? <p className="mt-6 text-sm text-muted-color">{error}</p> : null}
      {slug ? (
        <div className="mt-6">
          <OpdQueuePanel slug={slug} />
        </div>
      ) : null}
    </main>
  )
}
