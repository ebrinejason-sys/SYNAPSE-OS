'use server'

import { revalidatePath } from 'next/cache'
import { requirePlatformAdmin } from '@/lib/platform/auth'
import { sendUserPasswordReset } from '@/lib/auth/password-reset.server'
import { logPlatformEvent } from '../_lib/platform-data'
import { supabaseAdmin } from '@synapse/db/admin'

/**
 * Platform Admin: mark email verified so login/OTP guards pass without bypassing activation checks.
 * Does not delete identity or memberships.
 */
export async function activateUserAccount(formData: FormData) {
  const admin = await requirePlatformAdmin()
  const userId = String(formData.get('user_id') ?? '').trim()
  if (!userId) return { ok: false as const, error: 'User id required.' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const { data: profile } = await db
    .from('profiles')
    .select('id, email, role, email_verified_at, is_deleted')
    .eq('id', userId)
    .maybeSingle()

  if (!profile?.id) return { ok: false as const, error: 'User not found.' }
  if (profile.is_deleted) return { ok: false as const, error: 'User is archived/deleted.' }
  if (profile.role === 'platform_admin' || profile.role === 'superadmin') {
    // Activation still allowed for platform admins if pending, but never soft-delete them here.
  }

  if (!profile.email_verified_at) {
    const { error } = await db
      .from('profiles')
      .update({
        email_verified_at: new Date().toISOString(),
        verification_status: 'verified',
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
    if (error) return { ok: false as const, error: error.message }
  }

  await logPlatformEvent({
    actorId: admin.id,
    action: 'user.activated',
    entityType: 'profile',
    entityId: userId,
    metadata: { email: profile.email, role: profile.role },
  })
  revalidatePath('/platform/users')
  return { ok: true as const }
}

export async function deactivateUserAccount(formData: FormData) {
  const admin = await requirePlatformAdmin()
  const userId = String(formData.get('user_id') ?? '').trim()
  const reason = String(formData.get('reason') ?? '').trim()
  if (!userId) return { ok: false as const, error: 'User id required.' }
  if (!reason) return { ok: false as const, error: 'Reason required.' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const { data: profile } = await db
    .from('profiles')
    .select('id, role')
    .eq('id', userId)
    .maybeSingle()
  if (!profile?.id) return { ok: false as const, error: 'User not found.' }
  if (profile.role === 'platform_admin' || profile.role === 'superadmin') {
    const { count } = await db
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'platform_admin')
      .eq('is_deleted', false)
    if ((count ?? 0) <= 1) {
      return { ok: false as const, error: 'Cannot deactivate the last Platform Admin.' }
    }
  }

  const { error } = await db
    .from('profiles')
    .update({
      is_deleted: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
  if (error) return { ok: false as const, error: error.message }

  await db.from('synapse_sessions').delete().eq('user_id', userId)

  await logPlatformEvent({
    actorId: admin.id,
    action: 'user.deactivated',
    entityType: 'profile',
    entityId: userId,
    metadata: { reason, role: profile.role },
  })
  revalidatePath('/platform/users')
  return { ok: true as const }
}

export async function revokeUserSessions(formData: FormData) {
  const admin = await requirePlatformAdmin()
  const userId = String(formData.get('user_id') ?? '').trim()
  if (!userId) return { ok: false as const, error: 'User id required.' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const { error } = await db.from('synapse_sessions').delete().eq('user_id', userId)
  if (error) return { ok: false as const, error: error.message }

  await logPlatformEvent({
    actorId: admin.id,
    action: 'user.sessions_revoked',
    entityType: 'profile',
    entityId: userId,
    metadata: {},
  })
  revalidatePath('/platform/users')
  return { ok: true as const }
}

export async function removeFacilityMembership(formData: FormData) {
  const admin = await requirePlatformAdmin()
  const userId = String(formData.get('user_id') ?? '').trim()
  const tenantId = String(formData.get('tenant_id') ?? '').trim()
  if (!userId || !tenantId) return { ok: false as const, error: 'User and facility required.' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const { error } = await db
    .from('staff_scope_assignments')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('profile_id', userId)
    .eq('tenant_id', tenantId)
  if (error) return { ok: false as const, error: error.message }

  await logPlatformEvent({
    actorId: admin.id,
    action: 'user.membership_revoked',
    entityType: 'profile',
    entityId: userId,
    tenantId,
    metadata: {},
  })
  revalidatePath('/platform/users')
  revalidatePath(`/platform/facilities/${tenantId}`)
  return { ok: true as const }
}

export async function sendPasswordResetForUser(formData: FormData) {
  const admin = await requirePlatformAdmin()
  const userId = String(formData.get('user_id') ?? '').trim()
  const email = String(formData.get('email') ?? '').trim().toLowerCase()

  if (!userId || !email) {
    return { ok: false as const, error: 'User id and email are required.' }
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id, email, full_name, first_name, role')
    .eq('id', userId)
    .maybeSingle()

  if (!profile?.id || profile.email?.toLowerCase() !== email) {
    return { ok: false as const, error: 'User not found.' }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://synapseos.tech'
  const name =
    (profile.full_name as string | null) ??
    (profile.first_name as string | null) ??
    'there'

  const result = await sendUserPasswordReset({
    userId: profile.id as string,
    email,
    name,
    appUrl,
    activateIfPending: true,
  })

  if (!result.ok) {
    return { ok: false as const, error: result.error }
  }

  await logPlatformEvent({
    actorId: admin.id,
    action: 'user.password_reset_sent',
    entityType: 'profile',
    entityId: userId,
    metadata: { email, role: profile.role },
  })

  revalidatePath('/platform/users')
  return { ok: true as const, email: result.email }
}
