import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { jwtVerify } from 'jose'
import { supabaseAdmin } from '@synapse/db/admin'

const ISSUER     = 'synapse-health-technologies'
const AUDIENCE   = 'synapse-platform'
const MFA_COOKIE = 'synapse_mfa_pending'

function getJwtSecret(): Uint8Array {
  const s = process.env.SYNAPSE_JWT_SECRET
  if (!s) throw new Error('SYNAPSE_JWT_SECRET not set')
  return new TextEncoder().encode(s)
}

export async function GET(_req: NextRequest) {
  const cookieStore  = await cookies()
  const pendingToken = cookieStore.get(MFA_COOKIE)?.value

  if (!pendingToken) {
    return NextResponse.json({ error: 'No pending MFA session' }, { status: 401 })
  }

  let userId: string
  try {
    const { payload } = await jwtVerify(pendingToken, getJwtSecret(), { issuer: ISSUER, audience: AUDIENCE })
    if (payload['purpose'] !== 'totp_pending') throw new Error('wrong purpose')
    userId = payload.sub as string
  } catch {
    return NextResponse.json({ error: 'Invalid MFA session' }, { status: 401 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: enrollment } = await (supabaseAdmin as any)
    .from('mfa_enrollments')
    .select('id')
    .eq('user_id', userId)
    .eq('verified', true)
    .maybeSingle()

  return NextResponse.json({ enrolled: enrollment !== null })
}
