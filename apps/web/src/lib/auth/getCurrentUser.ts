import 'server-only'

import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { verifyToken } from '@synapse/auth/tokens'
import { validateSession } from '@synapse/auth'
import { supabaseAdmin } from '@synapse/db/admin'
import { SESSION_COOKIE } from '@synapse/config/constants'

export interface CurrentUser {
  id: string
  email: string | null
  role?: string
  tenantId?: string | null
  isAdmin?: boolean
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const cookieStore = await cookies()

  // 1. Try synapse_session
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (token) {
    try {
      const payload = await verifyToken(token)
      const { valid } = await validateSession(token)
      if (valid) {
        return {
          id:       payload.sub,
          email:    payload.email,
          role:     payload.role,
          tenantId: payload.tenant_id,
        }
      }
    } catch {
      // token invalid — fall through to Supabase
    }
  }

  // 2. Fall back to Supabase Auth (legacy sessions during transition)
  const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnon) return null

  try {
    const supabase = createServerClient(supabaseUrl, supabaseAnon, {
      cookies: {
        getAll:  () => cookieStore.getAll(),
        setAll:  (_c: { name: string; value: string; options?: Record<string, unknown> }[]) => {},
      },
    })
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    // Enrich with profile role/tenant from our DB
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role, tenant_id, is_admin')
      .eq('id', user.id)
      .maybeSingle()

    return {
      id:       user.id,
      email:    user.email ?? null,
      role:     profile?.role ?? undefined,
      tenantId: profile?.tenant_id ?? null,
      isAdmin:  profile?.is_admin ?? false,
    }
  } catch {
    return null
  }
}
