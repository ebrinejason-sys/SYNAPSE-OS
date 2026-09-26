'use server'

import { revalidatePath } from 'next/cache'
import { requirePlatformAccess } from '@/lib/platform/auth'
import { sendUserPasswordReset } from '@/lib/auth/password-reset.server'
import { logPlatformEvent } from '../_lib/platform-data'
import { supabaseAdmin } from '@synapse/db/admin'
import {
  isSelfDestructiveAction,
  previewIdentityLifecycle,
  SELF_LIFECYCLE_BLOCKER,
  type IdentityLifecycleAction,
} from '@synapse/db/identity-lifecycle'

async function platformAdminCount() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const { count } = await db
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .in('role', ['platform_admin', 'superadmin'])
    .eq('is_deleted', false)
  return count ?? 0
}

async function authoredRecordCount(userId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const queries = [
    db.from('clinical_prescriptions').select('id', { count: 'exact', head: true }).eq('prescriber_id', userId),
    db.from('encounters').select('id', { count: 'exact', head: true }).eq('clinician_id', userId),
    db.from('audit_log').select('id', { count: 'exact', head: true }).eq('user_id', userId),
  ]
  let total = 0
  for (const query of queries) {
    const { count, error } = await query
    if (error) return Number.POSITIVE_INFINITY
    total += count ?? 0
  }
  return total
}

async function guardIdentity(
  actorId: string,
  userId: string,
  action: IdentityLifecycleAction,
  typedConfirmation?: string,
) {
  // Server-side self-protection: an operator can never suspend, archive, purge,
  // deactivate, or strip the membership of their own identity, regardless of UI.
  if (isSelfDestructiveAction({ actorId, userId, action })) {
    await logPlatformEvent({
      actorId,
      action: 'user.self_lifecycle_blocked',
      entityType: 'profile',
      entityId: userId,
      metadata: { attempted_action: action },
    })
    return { ok: false as const, error: SELF_LIFECYCLE_BLOCKER }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const { data: profile } = await db
    .from('profiles')
    .select('id, email, role, verification_status, is_deleted, tenant_id')
    .eq('id', userId)
    .maybeSingle()
  if (!profile?.id) return { ok: false as const, error: 'User not found.' }

  let soleFacilityOwner = false
  if (action === 'remove_membership' || action === 'purge') {
    if (profile.role === 'hospital_admin' && profile.tenant_id) {
      const { count } = await db
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', profile.tenant_id)
        .eq('role', 'hospital_admin')
        .eq('is_deleted', false)
      soleFacilityOwner = (count ?? 0) <= 1
    }
  }

  const preview = previewIdentityLifecycle({
    userId,
    actorId,
    action,
    role: profile.role,
    isDeleted: Boolean(profile.is_deleted),
    verificationStatus: profile.verification_status,
    activePlatformAdminCount: await platformAdminCount(),
    authoredRecords: action === 'purge' ? await authoredRecordCount(userId) : 0,
    soleFacilityOwner,
    email: profile.email,
    typedConfirmation,
  })
  if (!preview.allowed) return { ok: false as const, error: preview.blockers[0] ?? 'Action blocked.', profile }
  return { ok: true as const, profile }
}

/**
 * Platform Admin: mark email verified so login/OTP guards pass without bypassing activation checks.
 * Does not delete identity or memberships.
 */
export async function activateUserAccount(formData: FormData) {
  const admin = await requirePlatformAccess('user.reactivate')
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

export async function suspendUserAccount(formData: FormData) {
  const admin = await requirePlatformAccess('user.suspend')
  const userId = String(formData.get('user_id') ?? '').trim()
  const reason = String(formData.get('reason') ?? '').trim()
  if (!userId) return { ok: false as const, error: 'User id required.' }
  if (!reason) return { ok: false as const, error: 'Reason required.' }

  const guard = await guardIdentity(admin.id, userId, 'suspend')
  if (!guard.ok) return guard

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const { error } = await db
    .from('profiles')
    .update({
      verification_status: 'suspended',
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
  if (error) return { ok: false as const, error: error.message }

  await db.from('synapse_sessions').delete().eq('user_id', userId)

  await logPlatformEvent({
    actorId: admin.id,
    action: 'user.suspended',
    entityType: 'profile',
    entityId: userId,
    metadata: { reason, role: guard.profile.role },
  })
  revalidatePath('/platform/users')
  revalidatePath(`/platform/users/${userId}`)
  return { ok: true as const }
}

/** Reversible suspension. Does not archive the identity or erase authorship. */
export async function deactivateUserAccount(formData: FormData) {
  return suspendUserAccount(formData)
}

export async function reactivateUserAccount(formData: FormData) {
  const admin = await requirePlatformAccess('user.reactivate')
  const userId = String(formData.get('user_id') ?? '').trim()
  if (!userId) return { ok: false as const, error: 'User id required.' }
  const guard = await guardIdentity(admin.id, userId, 'reactivate')
  if (!guard.ok) return guard

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const { error } = await db
    .from('profiles')
    .update({
      verification_status: 'verified',
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
  if (error) return { ok: false as const, error: error.message }

  await logPlatformEvent({
    actorId: admin.id,
    action: 'user.reactivated',
    entityType: 'profile',
    entityId: userId,
    metadata: { role: guard.profile.role },
  })
  revalidatePath('/platform/users')
  revalidatePath(`/platform/users/${userId}`)
  return { ok: true as const }
}

export async function restoreUserAccount(formData: FormData) {
  const admin = await requirePlatformAccess('user.reactivate')
  const userId = String(formData.get('user_id') ?? '').trim()
  if (!userId) return { ok: false as const, error: 'User id required.' }
  const guard = await guardIdentity(admin.id, userId, 'restore')
  if (!guard.ok) return guard

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const { error } = await db
    .from('profiles')
    .update({
      is_deleted: false,
      verification_status: 'verified',
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
  if (error) return { ok: false as const, error: error.message }
  await logPlatformEvent({
    actorId: admin.id,
    action: 'user.restored',
    entityType: 'profile',
    entityId: userId,
    metadata: { role: guard.profile.role },
  })
  revalidatePath('/platform/users')
  revalidatePath(`/platform/users/${userId}`)
  return { ok: true as const }
}

export async function archiveUserAccount(formData: FormData) {
  const admin = await requirePlatformAccess('user.suspend')
  const userId = String(formData.get('user_id') ?? '').trim()
  const reason = String(formData.get('reason') ?? '').trim()
  if (!userId) return { ok: false as const, error: 'User id required.' }
  if (!reason) return { ok: false as const, error: 'Reason required.' }
  const guard = await guardIdentity(admin.id, userId, 'archive')
  if (!guard.ok) return guard

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const { error } = await db
    .from('profiles')
    .update({ is_deleted: true, updated_at: new Date().toISOString() })
    .eq('id', userId)
  if (error) return { ok: false as const, error: error.message }
  await db.from('synapse_sessions').delete().eq('user_id', userId)
  await logPlatformEvent({
    actorId: admin.id,
    action: 'user.archived',
    entityType: 'profile',
    entityId: userId,
    metadata: { reason, role: guard.profile.role, authorship: 'preserved' },
  })
  revalidatePath('/platform/users')
  revalidatePath(`/platform/users/${userId}`)
  return { ok: true as const }
}

export async function permanentlyDeleteIdentity(formData: FormData) {
  const admin = await requirePlatformAccess('tenant.manage')
  const userId = String(formData.get('user_id') ?? '').trim()
  const typed = String(formData.get('typed_email') ?? '').trim()
  if (!userId) return { ok: false as const, error: 'User id required.' }
  const guard = await guardIdentity(admin.id, userId, 'purge', typed)
  if (!guard.ok) return guard

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  await db.from('synapse_sessions').delete().eq('user_id', userId)
  const { error } = await db.from('profiles').delete().eq('id', userId)
  if (error) return { ok: false as const, error: error.message }
  await logPlatformEvent({
    actorId: admin.id,
    action: 'user.purged',
    entityType: 'profile',
    entityId: userId,
    metadata: { email: guard.profile.email, role: guard.profile.role },
  })
  revalidatePath('/platform/users')
  return { ok: true as const }
}

export async function revokeUserSessions(formData: FormData) {
  const admin = await requirePlatformAccess('user.session.revoke')
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
  const admin = await requirePlatformAccess('tenant.manage')
  const userId = String(formData.get('user_id') ?? '').trim()
  const tenantId = String(formData.get('tenant_id') ?? '').trim()
  if (!userId || !tenantId) return { ok: false as const, error: 'User and facility required.' }
  const guard = await guardIdentity(admin.id, userId, 'remove_membership')
  if (!guard.ok) return guard

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
  const admin = await requirePlatformAccess('user.password_reset')
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
