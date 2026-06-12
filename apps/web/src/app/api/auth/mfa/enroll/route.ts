import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { jwtVerify } from 'jose'
import { supabaseAdmin } from '@synapse/db/admin'
import { generateTotpSecret, totpUri } from '@synapse/auth'

const ISSUER     = 'synapse-health-technologies'
const AUDIENCE   = 'synapse-platform'
const MFA_COOKIE = 'synapse_mfa_pending'

function getJwtSecret(): Uint8Array {
  const s = process.env.SYNAPSE_JWT_SECRET
  if (!s) throw new Error('SYNAPSE_JWT_SECRET not set')
  return new TextEncoder().encode(s)
}

export async function POST(_req: NextRequest) {
  const cookieStore = await cookies()
  const pendingToken = cookieStore.get(MFA_COOKIE)?.value

  if (!pendingToken) {
    return NextResponse.json({ error: 'MFA session expired. Please log in again.' }, { status: 401 })
  }

  let userId: string
  let email: string
  try {
    const { payload } = await jwtVerify(pendingToken, getJwtSecret(), { issuer: ISSUER, audience: AUDIENCE })
    if (payload['purpose'] !== 'totp_pending') throw new Error('wrong purpose')
    userId = payload.sub as string
    email  = payload['email'] as string
  } catch {
    return NextResponse.json({ error: 'MFA session invalid. Please log in again.' }, { status: 401 })
  }

  const secret = generateTotpSecret()
  const uri    = totpUri(secret, email)

  // Upsert unverified enrollment (a previous failed attempt may exist)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabaseAdmin as any)
    .from('mfa_enrollments')
    .upsert(
      { user_id: userId, secret, verified: false },
      { onConflict: 'user_id' }
    )

  if (error) {
    return NextResponse.json({ error: 'Failed to create authenticator setup.' }, { status: 500 })
  }

  // QR image via qrserver.com — rendered client-side from this URI
  return NextResponse.json({ uri, secret })
}
