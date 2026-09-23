"use client"

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { createClient } from "@/lib/supabase/client"
import type { PharmacySession } from "@/lib/auth"

export interface PharmacyUser {
  id: string
  email: string | undefined
  fullName: string | null
  pharmacyRole: string
  permissions: string[]
  tenantId: string | null
  isAdmin: boolean
  mustChangePassword: boolean
  isImpersonation: boolean
  impersonatorId: string | null
}

type SessionState = {
  user: PharmacyUser | null
  isLoading: boolean
  refresh: () => Promise<void>
}

const PharmacySessionContext = createContext<SessionState | null>(null)

async function loadSessionUser(): Promise<PharmacyUser | null> {
  try {
    const res = await fetch("/api/auth/session")
    if (res.ok) {
      const session: PharmacySession | null = await res.json()
      if (session) {
        return {
          id: session.userId,
          email: session.email,
          fullName: session.fullName,
          pharmacyRole: session.pharmacyRole ?? session.role,
          permissions: session.permissions ?? [],
          tenantId: session.tenantId,
          isAdmin: session.isAdmin,
          mustChangePassword: session.mustChangePassword,
          isImpersonation: session.isImpersonation ?? false,
          impersonatorId: session.impersonatorId ?? null,
        }
      }
    }
  } catch {
    // fall through to Supabase Auth
  }

  const supabase = createClient()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()
  if (!authUser) return null

  const [{ data: profile }, { data: userSettings }] = await Promise.all([
    supabase
      .from("profiles")
      .select("tenant_id, is_admin, full_name, first_name, last_name")
      .eq("id", authUser.id)
      .single(),
    supabase
      .from("pharmacy_user_settings")
      .select("pharmacy_role, permissions, is_active, must_change_password")
      .eq("profile_id", authUser.id)
      .single(),
  ])

  return {
    id: authUser.id,
    email: authUser.email,
    fullName:
      profile?.full_name ??
      [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ??
      authUser.email ??
      null,
    pharmacyRole: userSettings?.pharmacy_role ?? "pharmacy_staff",
    permissions: userSettings?.permissions ?? [],
    tenantId: profile?.tenant_id ?? null,
    isAdmin: profile?.is_admin ?? false,
    mustChangePassword: userSettings?.must_change_password ?? false,
    isImpersonation: false,
    impersonatorId: null,
  }
}

export function PharmacySessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PharmacyUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const next = await loadSessionUser()
      setUser(next)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    let unsubscribe: (() => void) | null = null

    void (async () => {
      try {
        const next = await loadSessionUser()
        if (!cancelled) setUser(next)
      } finally {
        if (!cancelled) setIsLoading(false)
      }

      // Keep Supabase-auth users in sync if they never moved to synapse_session.
      try {
        const supabase = createClient()
        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange(async (_event, session) => {
          if (cancelled) return
          if (!session?.user) {
            // Only clear if synapse session also missing — refresh handles that.
            await refresh()
            return
          }
          await refresh()
        })
        unsubscribe = () => subscription.unsubscribe()
      } catch {
        // ignore
      }
    })()

    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [refresh])

  const value = useMemo(
    () => ({ user, isLoading, refresh }),
    [user, isLoading, refresh],
  )

  return createElement(PharmacySessionContext.Provider, { value }, children)
}

export function usePharmacySession() {
  const ctx = useContext(PharmacySessionContext)
  const [fallbackUser, setFallbackUser] = useState<PharmacyUser | null>(null)
  const [fallbackLoading, setFallbackLoading] = useState(!ctx)

  useEffect(() => {
    if (ctx) return
    let cancelled = false
    void loadSessionUser().then((next) => {
      if (!cancelled) {
        setFallbackUser(next)
        setFallbackLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [ctx])

  if (ctx) return { user: ctx.user, isLoading: ctx.isLoading, refresh: ctx.refresh }

  return {
    user: fallbackUser,
    isLoading: fallbackLoading,
    refresh: async () => {
      setFallbackLoading(true)
      const next = await loadSessionUser()
      setFallbackUser(next)
      setFallbackLoading(false)
    },
  }
}
