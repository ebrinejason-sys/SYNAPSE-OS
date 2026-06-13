import { NextRequest, NextResponse } from 'next/server'
import { revokeAllUserSessions, verifyShortToken } from '@synapse/auth'
import { supabaseAdmin } from '@synapse/db/admin'

function redirectToLogin(req: NextRequest, status: 'activated' | 'invalid' | 'failed', email?: string) {
  const url = new URL('/login', req.nextUrl.origin)
  if (status === 'activated') {
    url.searchParams.set('activated', '1')
  } else {
    url.searchParams.set('activation', status)
  }
  if (email) url.searchParams.set('email', email)
  return NextResponse.redirect(url)
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token') ?? ''
  if (!token) return redirectToLogin(req, 'invalid')

  let payload: { sub: string }
  try {
    payload = await verifyShortToken(token, 'verify')
  } catch {
    return redirectToLogin(req, 'invalid')
  }

  const db = supabaseAdmin as any
  const { data: profile, error: profileErr } = await db
    .from('profiles')
    .select('id, email, role, verification_status, email_verified_at')
    .eq('id', payload.sub)
    .maybeSingle()

  if (profileErr || !profile) {
    return redirectToLogin(req, 'invalid')
  }

  const status = String(profile.verification_status ?? '').toLowerCase()
  if (status === 'suspended' || status === 'deleted' || status === 'disabled') {
    return redirectToLogin(req, 'failed', profile.email ?? undefined)
  }

  const updateData: Record<string, unknown> = {
    email_verified_at: new Date().toISOString(),
    login_attempts: 0,
    locked_until: null,
  }

  if (profile.role === 'patient' && status !== 'verified') {
    updateData.verification_status = 'verified'
  }

  const { error: updateErr } = await db
    .from('profiles')
    .update(updateData)
    .eq('id', profile.id)

  if (updateErr) {
    console.error('[auth/activate] update failed', updateErr)
    return redirectToLogin(req, 'failed', profile.email ?? undefined)
  }

  await revokeAllUserSessions(profile.id).catch(() => {})

  return redirectToLogin(req, 'activated', profile.email ?? undefined)
}
