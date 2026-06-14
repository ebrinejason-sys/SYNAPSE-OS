import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@synapse/db/admin'
import { verifyTotp } from '@synapse/auth'
import {
  signPharmMfaSatisfiedToken,
  pharmMfaCookieOptions,
  PHARM_MFA_SATISFIED_COOKIE,
} from '@synapse/auth/mfa'
import { requireSynapseSessionUser, unauthorized } from '@/lib/mfa-session'

export async function POST(req: NextRequest) {
  const user = await requireSynapseSessionUser()
  if (!user) return unauthorized()

  const body = await req.json().catch(() => ({}))
  const code = typeof body.code === 'string' ? body.code.trim() : ''

  if (!code || code.length !== 6) {
    return NextResponse.json({ error: '6-digit code required' }, { status: 400 })
  }

  const db = supabaseAdmin as any
  const { data: enrollment } = await db
    .from('mfa_enrollments')
    .select('id, secret')
    .eq('user_id', user.id)
    .eq('verified', true)
    .maybeSingle()

  if (!enrollment) {
    return NextResponse.json({ error: 'No verified authenticator found. Set up MFA first.' }, { status: 404 })
  }

  const valid = await verifyTotp(enrollment.secret as string, code)
  if (!valid) {
    return NextResponse.json({ error: 'Incorrect code. Check your authenticator app.' }, { status: 401 })
  }

  await db
    .from('mfa_enrollments')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', enrollment.id)

  const cookieStore = await cookies()
  const satisfiedToken = await signPharmMfaSatisfiedToken(user.id)
  cookieStore.set(PHARM_MFA_SATISFIED_COOKIE, satisfiedToken, pharmMfaCookieOptions)

  return NextResponse.json({ ok: true })
}
