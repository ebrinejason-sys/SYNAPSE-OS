import { NextRequest, NextResponse } from 'next/server'
import { createSession, hashPassword, signToken } from '@synapse/auth'
import { SESSION_COOKIE, SESSION_DURATION_DAYS } from '@synapse/config/constants'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const inviteToken = String(body.token ?? '').trim()
  const password = String(body.password ?? '')
  if (!inviteToken) return NextResponse.json({ error: 'Missing invite token.' }, { status: 400 })
  if (password.length < 8) return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 })

  const db = supabaseAdmin as any
  const { data: invite } = await db
    .from('facility_invitations')
    .select('id, tenant_id, profile_id, email, role, status, expires_at')
    .eq('invite_token', inviteToken)
    .maybeSingle()

  if (!invite) return NextResponse.json({ error: 'Invalid invite token.' }, { status: 404 })
  if (invite.status === 'ACCEPTED') return NextResponse.json({ error: 'This invite has already been used.' }, { status: 409 })
  if (invite.status === 'REVOKED') return NextResponse.json({ error: 'This invite was revoked.' }, { status: 410 })
  if (new Date(invite.expires_at) < new Date()) {
    await db.from('facility_invitations').update({ status: 'EXPIRED', updated_at: new Date().toISOString() }).eq('id', invite.id)
    return NextResponse.json({ error: 'This invite has expired.' }, { status: 410 })
  }

  const [{ data: tenant }, { data: profile }] = await Promise.all([
    db.from('tenants').select('id, facility_type, status, is_active').eq('id', invite.tenant_id).maybeSingle(),
    db.from('profiles').select('id, email, role, tenant_id, synapse_id').eq('id', invite.profile_id).maybeSingle(),
  ])
  if (!tenant || tenant.facility_type !== 'pharmacy' || tenant.status !== 'active' || tenant.is_active !== true) {
    return NextResponse.json({ error: 'Pharmacy facility is unavailable.' }, { status: 403 })
  }
  if (!profile || profile.tenant_id !== invite.tenant_id || profile.role !== 'pharmacy_admin') {
    return NextResponse.json({ error: 'Invitation account does not match this pharmacy.' }, { status: 403 })
  }

  const now = new Date().toISOString()
  const passwordHash = await hashPassword(password)
  const { error: profileError } = await db.from('profiles').update({
    password_hash: passwordHash,
    must_change_password: false,
    password_changed_at: now,
    email_verified_at: now,
    verification_status: 'verified',
    onboarding_complete: false,
    updated_at: now,
  }).eq('id', profile.id).eq('tenant_id', invite.tenant_id)
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 })

  await db.from('facility_invitations').update({ status: 'ACCEPTED', accepted_at: now, updated_at: now }).eq('id', invite.id)

  const token = await signToken({
    sub: profile.id,
    email: profile.email ?? invite.email,
    role: profile.role,
    tenant_id: invite.tenant_id,
    app: 'pharmacy',
    synapse_id: profile.synapse_id ?? undefined,
  })
  await createSession({ userId: profile.id, token, app: 'pharmacy', ip: request.headers.get('x-forwarded-for') ?? undefined, userAgent: request.headers.get('user-agent') ?? undefined })

  const expires = new Date()
  expires.setDate(expires.getDate() + SESSION_DURATION_DAYS)
  const response = NextResponse.json({ ok: true, redirectTo: '/onboarding' })
  response.cookies.set(SESSION_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', expires, path: '/' })
  return response
}
