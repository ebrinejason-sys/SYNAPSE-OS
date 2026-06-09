"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { User } from "@supabase/supabase-js"

export interface PharmacyUser {
  id: string
  email: string | undefined
  fullName: string | null
  pharmacyRole: string
  permissions: string[]
  tenantId: string | null
  isAdmin: boolean
  mustChangePassword: boolean
}

export function usePharmacySession() {
  const [user, setUser] = useState<PharmacyUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    async function loadSession(authUser: User | null) {
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
      })
      setIsLoading(false)
    }

    supabase.auth.getUser().then(({ data: { user: u } }) => loadSession(u))

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => loadSession(session?.user ?? null)
    )
    return () => subscription.unsubscribe()
  }, [])

  return { user, isLoading }
}
