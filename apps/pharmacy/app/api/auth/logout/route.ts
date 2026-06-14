import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { revokeSession } from '@synapse/auth'
import {
  MFA_PENDING_COOKIE,
  PHARM_MFA_SATISFIED_COOKIE,
} from '@synapse/auth/mfa'
import { SESSION_COOKIE } from '@synapse/config/constants'

export async function POST(_req: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value

  if (token) {
    await revokeSession(token).catch(() => {})
  }

  cookieStore.delete(SESSION_COOKIE)
  cookieStore.delete(MFA_PENDING_COOKIE)
  cookieStore.delete(PHARM_MFA_SATISFIED_COOKIE)

  return NextResponse.json({ ok: true })
}
