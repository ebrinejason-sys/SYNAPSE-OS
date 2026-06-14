import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyMfaPendingToken, MFA_PENDING_COOKIE } from '@synapse/auth/mfa'
import { supabaseAdmin } from '@synapse/db/admin'

export async function GET(_req: NextRequest) {
  const cookieStore  = await cookies()
  const pendingToken = cookieStore.get(MFA_PENDING_COOKIE)?.value

  if (!pendingToken) {
    return NextResponse.json({ error: 'No pending MFA session' }, { status: 401 })
  }

  let userId: string
  try {
    const payload = await verifyMfaPendingToken(pendingToken)
    userId = payload.sub
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
