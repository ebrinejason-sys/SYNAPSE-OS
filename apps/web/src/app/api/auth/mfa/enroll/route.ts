import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyMfaPendingToken, MFA_PENDING_COOKIE } from '@synapse/auth/mfa'
import { supabaseAdmin } from '@synapse/db/admin'
import { generateTotpSecret, totpUri } from '@synapse/auth'

export async function POST(_req: NextRequest) {
  const cookieStore = await cookies()
  const pendingToken = cookieStore.get(MFA_PENDING_COOKIE)?.value

  if (!pendingToken) {
    return NextResponse.json({ error: 'MFA session expired. Please log in again.' }, { status: 401 })
  }

  let userId: string
  let email: string
  try {
    const payload = await verifyMfaPendingToken(pendingToken)
    userId = payload.sub
    email  = payload.email
  } catch {
    return NextResponse.json({ error: 'MFA session invalid. Please log in again.' }, { status: 401 })
  }

  const secret = generateTotpSecret()
  const uri    = totpUri(secret, email)

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

  return NextResponse.json({ uri, secret })
}
