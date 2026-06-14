import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import {
  PHARM_MFA_SATISFIED_COOKIE,
  verifyPharmMfaSatisfiedToken,
} from '@synapse/auth/mfa'
import { supabaseAdmin } from '@synapse/db/admin'
import { requireSynapseSessionUser, unauthorized } from '@/lib/mfa-session'

export async function GET() {
  const user = await requireSynapseSessionUser()
  if (!user) return unauthorized()

  const cookieStore = await cookies()
  const satisfiedToken = cookieStore.get(PHARM_MFA_SATISFIED_COOKIE)?.value
  const satisfied = satisfiedToken
    ? await verifyPharmMfaSatisfiedToken(satisfiedToken, user.id)
    : false

  const db = supabaseAdmin as any
  const { data: enrollment } = await db
    .from('mfa_enrollments')
    .select('id, verified')
    .eq('user_id', user.id)
    .maybeSingle()

  return NextResponse.json({
    enrolled: enrollment?.verified === true,
    satisfied,
    hasPendingEnrollment: enrollment?.verified === false,
  })
}
