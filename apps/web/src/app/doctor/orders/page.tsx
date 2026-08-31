'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function DoctorOrdersRedirect() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const qs = searchParams.toString()
    fetch('/api/auth/me', { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) {
          setReady(true)
          return
        }
        const data = await res.json()
        const tenantSlug = data.user?.tenantSlug as string | undefined
        if (tenantSlug) {
          const target = `/os/${tenantSlug}/clinical/orders${qs ? `?${qs}` : ''}`
          router.replace(target)
          return
        }
        setReady(true)
      })
      .catch(() => setReady(true))
  }, [router, searchParams])

  if (!ready) {
    return (
      <main className="clinical-page p-8">
        <p className="text-sm text-muted-color">Loading…</p>
      </main>
    )
  }

  return (
    <main className="clinical-page mx-auto max-w-4xl p-8">
      <h1 className="font-display text-2xl">Clinical orders</h1>
      <p className="mt-2 text-sm text-muted-color">
        Sign in with a hospital tenant, then use{' '}
        <code className="text-xs">/os/[your-slug]/clinical/orders</code> as the canonical clinical shell.
      </p>
    </main>
  )
}

export default function DoctorOrdersPage() {
  return (
    <Suspense fallback={<div className="clinical-page p-8">Loading…</div>}>
      <DoctorOrdersRedirect />
    </Suspense>
  )
}
