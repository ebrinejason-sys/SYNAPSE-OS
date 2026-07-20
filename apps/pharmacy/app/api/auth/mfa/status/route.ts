import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import {
  PHARM_MFA_SATISFIED_COOKIE,
  verifyPharmMfaSatisfiedToken,
} from '@synapse/auth/mfa'
import { supabaseAdmin } from '@synapse/db/admin'
import { requirePharmacyApiSession } from "@/lib/api-auth"
export async function GET() {
  const auth = await requirePharmacyApiSession()
  if (!auth.ok) return auth.response
  const user = { id: auth.session.userId, email: auth.session.email }

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
