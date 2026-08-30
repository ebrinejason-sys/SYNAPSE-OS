'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { hashPassword, signToken, createSession } from '@synapse/auth'
import { supabaseAdmin } from '@synapse/db/admin'
import { SESSION_COOKIE, SESSION_DURATION_DAYS } from '@synapse/config/constants'
import { hashInviteToken } from '@/lib/platform/membership.server'
import { logPlatformAccessEvent } from '@/lib/platform/access-audit'

export async function acceptPlatformInvite(
  formData: FormData
): Promise<{ error: string } | never> {
  const token = String(formData.get('token') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  const confirm = String(formData.get('confirmPassword') ?? '')

  if (!token) return { error: 'Missing invite token.' }
  if (password.length < 8) return { error: 'Password must be at least 8 characters.' }
  if (password !== confirm) return { error: 'Passwords do not match.' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const tokenHash = hashInviteToken(token)

  const { data: invitation } = await db
    .from('platform_invitations')
    .select('*')
    .eq('token_hash', tokenHash)
    .eq('status', 'PENDING')
    .maybeSingle()

  if (!invitation) return { error: 'Invalid or expired invitation.' }
  if (new Date(invitation.expires_at as string) < new Date()) {
    await db.from('platform_invitations').update({ status: 'EXPIRED', updated_at: new Date().toISOString() }).eq('id', invitation.id)
    return { error: 'This invitation has expired.' }
  }

  const email = (invitation.email as string).toLowerCase()
  const { data: profile } = await db
    .from('profiles')
    .select('id, email, role, synapse_id')
    .eq('email', email)
    .maybeSingle()

  if (!profile?.id) return { error: 'Account profile not found. Contact your administrator.' }

  const passwordHash = await hashPassword(password)
  const now = new Date().toISOString()

  await db
    .from('profiles')
    .update({
      password_hash: passwordHash,
      email_verified_at: now,
      must_change_password: false,
      login_attempts: 0,
      locked_until: null,
      updated_at: now,
    })
    .eq('id', profile.id)

  if (invitation.membership_id) {
    await db
      .from('platform_memberships')
      .update({ status: 'ACTIVE', accepted_at: now, updated_at: now })
      .eq('id', invitation.membership_id)
  }

  await db
    .from('platform_invitations')
    .update({ status: 'ACCEPTED', accepted_at: now, updated_at: now })
    .eq('id', invitation.id)

  await logPlatformAccessEvent({
    actorId: profile.id as string,
    actorRole: invitation.platform_role as string,
    action: 'PLATFORM_MEMBER_ACTIVATED',
    targetUserId: profile.id as string,
    resourceId: invitation.membership_id as string,
  })

  const jwtToken = await signToken({
    sub: profile.id as string,
    email: profile.email as string,
    role: profile.role as string,
    tenant_id: '',
    app: 'web',
    synapse_id: (profile.synapse_id as string | null) ?? undefined,
  })

  await createSession({ userId: profile.id as string, token: jwtToken, app: 'web' })

  const expires = new Date()
  expires.setDate(expires.getDate() + SESSION_DURATION_DAYS)
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, jwtToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires,
    path: '/',
  })

  redirect('/platform/performance')
}
