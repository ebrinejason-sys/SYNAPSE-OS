'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export function FacilityCanonicalRedirect({
  pathForSlug,
  fallbackHref,
  label,
}: {
  pathForSlug: (slug: string) => string
  fallbackHref: string
  label: string
}) {
  const router = useRouter()
  const [message, setMessage] = useState('Opening the canonical workspace…')

  useEffect(() => {
    let cancelled = false
    fetch('/api/auth/me', { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) {
          if (!cancelled) router.replace(`/login?next=${encodeURIComponent(fallbackHref)}`)
          return
        }
        const data = await res.json()
        const tenantSlug = data.user?.tenantSlug as string | undefined
        if (!cancelled) router.replace(tenantSlug ? pathForSlug(tenantSlug) : fallbackHref)
      })
      .catch(() => {
        if (!cancelled) {
          setMessage(`Sign in to open ${label}.`)
          router.replace(`/login?next=${encodeURIComponent(fallbackHref)}`)
        }
      })
    return () => {
      cancelled = true
    }
  }, [fallbackHref, label, pathForSlug, router])

  return (
    <main className="clinical-page p-8">
      <p className="text-sm text-muted-color">{message}</p>
    </main>
  )
}
