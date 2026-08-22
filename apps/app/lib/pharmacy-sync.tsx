import { useEffect } from 'react'
import { AppState } from 'react-native'
import { useAuth } from '@/lib/auth'
import { syncPharmacySales } from '@/lib/offline-store'

const FLUSH_INTERVAL_MS = 15_000

/**
 * Background retry worker. SQLite already holds committed sales; this only
 * attempts apply after network returns or the app is foregrounded.
 */
export function PharmacySyncHost({ children }: { children: React.ReactNode }) {
  const { token, user } = useAuth()

  useEffect(() => {
    if (!token || !user?.tenantId) return
    const tenantId = user.tenantId
    let cancelled = false

    const run = () => {
      if (cancelled) return
      void syncPharmacySales(tenantId, token).catch(() => undefined)
    }

    run()
    const interval = setInterval(run, FLUSH_INTERVAL_MS)
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') run()
    })

    return () => {
      cancelled = true
      clearInterval(interval)
      sub.remove()
    }
  }, [token, user?.tenantId])

  return children
}
