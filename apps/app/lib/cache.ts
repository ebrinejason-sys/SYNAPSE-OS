import AsyncStorage from '@react-native-async-storage/async-storage'
import { useCallback, useEffect, useRef, useState } from 'react'
import { apiRequest } from '@/lib/api'

const KEY_PREFIX = 'synapse_cache:'

interface CacheEntry<T> {
  data: T
  cachedAt: number
}

// ─── Core cache helpers ──────────────────────────────────────────────────────

export async function getCached<T>(
  key: string
): Promise<{ data: T; stale: boolean } | null> {
  try {
    const raw = await AsyncStorage.getItem(`${KEY_PREFIX}${key}`)
    if (!raw) return null
    const entry: CacheEntry<T> = JSON.parse(raw)
    return { data: entry.data, stale: false }
  } catch {
    return null
  }
}

export async function getCachedWithTtl<T>(
  key: string,
  ttlMs: number
): Promise<{ data: T; stale: boolean } | null> {
  try {
    const raw = await AsyncStorage.getItem(`${KEY_PREFIX}${key}`)
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
  _ttlMs: number
): Promise<void> {
  try {
    const entry: CacheEntry<T> = { data, cachedAt: Date.now() }
    await AsyncStorage.setItem(`${KEY_PREFIX}${key}`, JSON.stringify(entry))
  } catch {
    // Storage failure is non-fatal — app continues with live data
  }
}

export async function clearCached(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(`${KEY_PREFIX}${key}`)
  } catch {
    // Ignore
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

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useCachedRequest<T>(
  path: string,
  token: string | null,
  ttlMs: number
): { data: T | null; loading: boolean; stale: boolean; refresh: () => void } {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [stale, setStale] = useState(false)

  // Stable ref so refresh closure never captures a stale version
  const fetchRef = useRef<(() => Promise<void>) | null>(null)

  const cacheKey = path

  const fetchFresh = useCallback(async () => {
    if (!token) return
    try {
      const fresh = await apiRequest<T>(path, { token })
      setData(fresh)
      setStale(false)
      await setCached(cacheKey, fresh, ttlMs)
    } catch {
      // Keep showing cached data on fetch failure
    }
  }, [path, token, ttlMs, cacheKey])

  fetchRef.current = fetchFresh

  const refresh = useCallback(() => {
    fetchRef.current?.()
  }, [])

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)

      // 1. Show cached data immediately (no spinner)
      const cached = await getCachedWithTtl<T>(cacheKey, ttlMs)
      if (!cancelled && cached) {
        setData(cached.data)
        setStale(cached.stale)
        setLoading(false)

        // Revalidate in background if stale
        if (cached.stale && token) {
          fetchRef.current?.()
        }
        return
      }

      // 2. No cache — fetch live
      if (!cancelled) setLoading(true)
      if (token) {
        try {
          const fresh = await apiRequest<T>(path, { token })
          if (!cancelled) {
            setData(fresh)
            setStale(false)
            await setCached(cacheKey, fresh, ttlMs)
          }
        } catch {
          // Network failure — data stays null
        }
      }

      if (!cancelled) setLoading(false)
    }

    load()

    return () => {
      cancelled = true
    }
  }, [path, token, ttlMs, cacheKey])

  return { data, loading, stale, refresh }
}
