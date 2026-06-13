import 'server-only'

import { cookies } from 'next/headers'
import { verifyToken } from '@synapse/auth/tokens'
import { validateSession } from '@synapse/auth'
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
  const token = cookieStore.get(SESSION_COOKIE)?.value

  if (!token) return null

  try {
    const payload = await verifyToken(token)
    const { valid } = await validateSession(token)
    if (!valid) return null

    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      tenantId: payload.tenant_id,
    }
  } catch {
    return null
  }
}
