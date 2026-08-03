import { useEffect } from 'react'
import * as Notifications from 'expo-notifications'
import { router } from 'expo-router'

/** Map push `data.url` / `data.target` (e.g. app:/queue) → expo-router path. */
function pathFromPushTarget(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return null
  let value = raw.trim()
  if (value.startsWith('app:')) value = value.slice(4)
  if (!value.startsWith('/')) value = `/${value}`

  const allowed = new Set([
    '/home',
    '/queue',
    '/records',
    '/appointments',
    '/stock',
    '/lab',
    '/claims',
    '/patients',
    '/meds',
    '/profile',
  ])
  const base = value.split('?')[0]
  if (!allowed.has(base)) return '/home'
  return value
}

function navigateToTarget(data: Record<string, unknown> | undefined) {
  if (!data) return
  const target = pathFromPushTarget(data.url ?? data.target)
  if (!target) return
  // Tab routes live under (main)
  const href = `/(main)${target}` as const
  try {
    router.push(href)
  } catch {
    router.push('/(main)/home')
  }
}

/**
 * Handles notification taps (cold + warm start) for deep links.
 */
export function usePushDeepLinks(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return

    let cancelled = false

    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (cancelled || !response) return
        navigateToTarget(response.notification.request.content.data as Record<string, unknown>)
      })
      .catch(() => {})

    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      navigateToTarget(response.notification.request.content.data as Record<string, unknown>)
    })

    return () => {
      cancelled = true
      sub.remove()
    }
  }, [enabled])
}
