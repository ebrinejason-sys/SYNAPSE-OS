"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { User } from "@supabase/supabase-js"
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

export function usePharmacySession() {
  const [user, setUser] = useState<PharmacyUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    let unsubscribe: (() => void) | null = null

    async function init() {
      // Try synapse_session first (new auth system)
      try {
        const res = await fetch('/api/auth/session')
        if (!cancelled && res.ok) {
          const session: PharmacySession | null = await res.json()
          if (!cancelled && session) {
            setUser({
              id: session.userId,
              email: session.email,
              fullName: session.fullName,
              pharmacyRole: session.role,
              permissions: [],
              tenantId: session.tenantId,
              isAdmin: session.isAdmin,
              mustChangePassword: session.mustChangePassword,
              isImpersonation: session.isImpersonation ?? false,
              impersonatorId: session.impersonatorId ?? null,
            })
            setIsLoading(false)
            return
          }
        }
      } catch {
        // fall through to Supabase Auth
      }

      if (cancelled) return

      // Fall back to Supabase Auth for unmigrated users
      const supabase = createClient()

      async function loadSupabaseUser(authUser: User | null) {
        if (cancelled) return
        if (!authUser) {
          setUser(null)
          setIsLoading(false)
          return
        }

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

        if (cancelled) return
        setUser({
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
        })
        setIsLoading(false)
      }

      const { data: { user: u } } = await supabase.auth.getUser()
      await loadSupabaseUser(u)

      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        (_event, session) => loadSupabaseUser(session?.user ?? null)
      )
      unsubscribe = () => subscription.unsubscribe()
    }

    init()

    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [])

  return { user, isLoading }
}
