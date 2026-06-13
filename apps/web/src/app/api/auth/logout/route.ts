import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { revokeSession } from '@synapse/auth'
import { SESSION_COOKIE } from '@synapse/config/constants'

export async function POST(_req: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value

  if (token) {
    await revokeSession(token).catch(() => {})
  }

  cookieStore.delete(SESSION_COOKIE)

  return NextResponse.json({ ok: true })
}
