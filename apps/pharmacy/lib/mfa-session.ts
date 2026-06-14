import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@synapse/auth/tokens'
import { validateSession } from '@synapse/auth'
import { SESSION_COOKIE } from '@synapse/config/constants'

export async function requireSynapseSessionUser(): Promise<{ id: string; email: string } | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) return null

  try {
    const payload = await verifyToken(token)
    const { valid } = await validateSession(token)
    if (!valid) return null
    return { id: payload.sub, email: payload.email }
  } catch {
    return null
  }
}

export function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
