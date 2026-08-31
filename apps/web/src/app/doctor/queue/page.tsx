'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function DoctorQueuePage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) {
          setReady(true)
          return
        }
        const data = await res.json()
        const tenantSlug = data.user?.tenantSlug as string | undefined
        if (tenantSlug) {
          router.replace(`/os/${tenantSlug}/clinical/queue`)
          return
        }
        setReady(true)
      })
      .catch(() => setReady(true))
  }, [router])

  if (!ready) {
    return (
      <main className="clinical-page p-8">
        <p className="text-sm text-muted-color">Loading…</p>
      </main>
    )
  }

  return (
    <main className="clinical-page mx-auto max-w-4xl p-8">
      <h1 className="font-display text-2xl">OPD queue</h1>
      <p className="mt-2 text-sm text-muted-color">
        Sign in with a hospital tenant, then use{' '}
        <code className="text-xs">/os/[your-slug]/clinical/queue</code> as the canonical clinical shell.
      </p>
    </main>
  )
}
