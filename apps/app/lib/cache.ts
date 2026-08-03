import AsyncStorage from '@react-native-async-storage/async-storage'
import { useCallback, useEffect, useRef, useState } from 'react'
import { apiRequest } from '@/lib/api'

const KEY_PREFIX = 'synapse_cache:'

interface CacheEntry<T> {
  data: T
  cachedAt: number
  userId?: string
}

function scopedKey(userId: string | null | undefined, path: string): string {
  const scope = userId?.trim() || '_anon'
  return `${KEY_PREFIX}${scope}:${path}`
}

// ─── Core cache helpers ──────────────────────────────────────────────────────

export async function getCachedWithTtl<T>(
  key: string,
  ttlMs: number
): Promise<{ data: T; stale: boolean } | null> {
  try {
    const raw = await AsyncStorage.getItem(key)
    if (!raw) return null
    const entry: CacheEntry<T> = JSON.parse(raw)
    const stale = Date.now() - entry.cachedAt > ttlMs
    return { data: entry.data, stale }
  } catch {
    return null
  }
}

export async function setCached<T>(
  key: string,
  data: T,
  _ttlMs: number,
  userId?: string | null
): Promise<void> {
  try {
    const entry: CacheEntry<T> = {
      data,
      cachedAt: Date.now(),
      userId: userId ?? undefined,
    }
    await AsyncStorage.setItem(key, JSON.stringify(entry))
  } catch {
    // Storage failure is non-fatal — app continues with live data
  }
}

export async function clearAllCache(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys()
    const cacheKeys = keys.filter((k) => k.startsWith(KEY_PREFIX))
    if (cacheKeys.length > 0) {
      await AsyncStorage.multiRemove(cacheKeys)
    }
  } catch {
    // Ignore
  }
}

/** Purge cache for one user scope (and legacy unscoped keys). */
export async function clearUserCache(userId?: string | null): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys()
    const prefixes = userId
      ? [`${KEY_PREFIX}${userId}:`, `${KEY_PREFIX}_anon:`, KEY_PREFIX]
      : [KEY_PREFIX]
    const cacheKeys = keys.filter((k) => prefixes.some((p) => k.startsWith(p)))
    if (cacheKeys.length > 0) {
      await AsyncStorage.multiRemove(cacheKeys)
    }
  } catch {
    // Ignore
  }
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useCachedRequest<T>(
  path: string,
  token: string | null,
  ttlMs: number,
  userId?: string | null
): { data: T | null; loading: boolean; stale: boolean; refresh: () => void } {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [stale, setStale] = useState(false)

  const fetchRef = useRef<(() => Promise<void>) | null>(null)
  // Never read cache without a known user scope — prevents cross-user PHI flash.
  const cacheKey = token ? scopedKey(userId, path) : null

  const fetchFresh = useCallback(async () => {
    if (!token || !cacheKey) return
    try {
      const fresh = await apiRequest<T>(path, { token })
      setData(fresh)
      setStale(false)
      await setCached(cacheKey, fresh, ttlMs, userId)
    } catch {
      // Keep showing cached data on fetch failure
    }
  }, [path, token, ttlMs, cacheKey, userId])

  fetchRef.current = fetchFresh

  const refresh = useCallback(() => {
    fetchRef.current?.()
  }, [])

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)

      if (!token || !cacheKey) {
        setData(null)
        setStale(false)
        setLoading(false)
        return
      }

      const cached = await getCachedWithTtl<T>(cacheKey, ttlMs)
      if (!cancelled && cached) {
        setData(cached.data)
        setStale(cached.stale)
        setLoading(false)
        if (cached.stale) {
          fetchRef.current?.()
        }
        return
      }

      try {
        const fresh = await apiRequest<T>(path, { token })
        if (!cancelled) {
          setData(fresh)
          setStale(false)
          await setCached(cacheKey, fresh, ttlMs, userId)
        }
      } catch {
        // Network failure — data stays null
      }

      if (!cancelled) setLoading(false)
    }

    load()

    return () => {
      cancelled = true
    }
  }, [path, token, ttlMs, cacheKey, userId])

  return { data, loading, stale, refresh }
}
