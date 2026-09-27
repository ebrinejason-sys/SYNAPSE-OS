'use server'

import { revalidatePath } from 'next/cache'
import { requirePlatformAccess } from '@/lib/platform/auth'
import { sendUserPasswordReset } from '@/lib/auth/password-reset.server'
import { logPlatformEvent } from '../_lib/platform-data'
import { supabaseAdmin } from '@synapse/db/admin'
import {
  ACCOUNT_SUSPENSION_MARKER_ROLE,
  ACCOUNT_SUSPENSION_METADATA_KEY,
  isAccountSuspended,
  suspendedUserIds,
  suspensionMetadataOf,
} from '@synapse/auth/account-suspension'
import { canManageTargetRole, isPlatformRole } from '../../../lib/platform/rbac'
import {
  isSelfDestructiveAction,
  previewIdentityLifecycle,
  SELF_LIFECYCLE_BLOCKER,
  type IdentityLifecycleAction,
} from '@synapse/db/identity-lifecycle'

/** verification_status markers that archive/suspend set and restore lifts (auth treats them as unavailable). */
const RESTORE_LIFTS_STATUSES = new Set(['suspended', 'disabled', 'reset', 'deleted'])

const PLATFORM_PROFILE_ROLES = new Set(['platform_admin', 'superadmin'])

async function platformAdminCount() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const { data } = await db
    .from('profiles')
    .select('id')
    .in('role', ['platform_admin', 'superadmin'])
    .eq('is_deleted', false)
  const ids = ((data ?? []) as Array<{ id: string }>).map((r) => r.id)
  if (ids.length === 0) return 0
  // A suspended platform admin cannot act, so it does not count toward "another admin remains".
  const suspended = new Set(await suspendedUserIds(db, ids))
  return ids.filter((id) => !suspended.has(id)).length
}

type MembershipRow = { id: string; platform_role: string | null; status: string; metadata: Record<string, unknown> | null }

async function membershipRows(userId: string): Promise<MembershipRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const { data, error } = await db
    .from('platform_memberships')
    .select('id, platform_role, status, metadata')
    .eq('user_id', userId)
  if (error) throw new Error(`Membership lookup failed: ${error.message}`)
  return (data ?? []) as MembershipRow[]
}

/** Operators may only suspend/unsuspend control-plane users whose platform role they can manage. */
function blockedByRoleHierarchy(actorRole: string, rows: MembershipRow[]): string | null {
  for (const row of rows) {
    if (suspensionMetadataOf(row)?.marker) continue
    const role = String(row.platform_role ?? '')
    if (isPlatformRole(role) && isPlatformRole(actorRole) && !canManageTargetRole(actorRole, role)) {
      return 'You cannot change the account state of a platform member with this role.'
    }
  }
  return null
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

  // Suspension lives on platform_memberships (verification_status cannot hold it).
  const targetSuspended = await isAccountSuspended(userId)
  const preview = previewIdentityLifecycle({
    userId,
    actorId,
    action,
    role: profile.role,
    isDeleted: Boolean(profile.is_deleted),
    verificationStatus: targetSuspended ? 'suspended' : profile.verification_status,
    // The lifecycle rule counts the target itself; a suspended target is excluded by
    // platformAdminCount(), so add it back to keep "another usable admin remains" exact.
    activePlatformAdminCount: (await platformAdminCount()) + (targetSuspended && PLATFORM_PROFILE_ROLES.has(String(profile.role)) ? 1 : 0),
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

  const rows = await membershipRows(userId)
  if (rows.some((r) => r.status === 'SUSPENDED')) return { ok: false as const, error: 'Account is already suspended.' }
  const hierarchy = blockedByRoleHierarchy(admin.platformRole, rows)
  if (hierarchy) return { ok: false as const, error: hierarchy }

  // Never write 'suspended' into profiles.verification_status (constrained to the
  // professional-verification states). Suspension is a SUSPENDED membership row.
  const now = new Date().toISOString()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const suspension = { suspended_at: now, suspended_by: admin.id, reason }
  if (rows.length > 0) {
    for (const row of rows) {
      const { error } = await db
        .from('platform_memberships')
        .update({
          status: 'SUSPENDED',
          metadata: { ...(row.metadata ?? {}), [ACCOUNT_SUSPENSION_METADATA_KEY]: { ...suspension, previous_status: row.status } },
          updated_at: now,
        })
        .eq('id', row.id)
      if (error) return { ok: false as const, error: error.message }
    }
  } else {
    const { error } = await db.from('platform_memberships').insert({
      user_id: userId,
      platform_role: ACCOUNT_SUSPENSION_MARKER_ROLE,
      status: 'SUSPENDED',
      mfa_required: false,
      notes: 'Account suspension marker. Grants no access; removed on reactivation.',
      metadata: { [ACCOUNT_SUSPENSION_METADATA_KEY]: { ...suspension, marker: true, previous_status: null } },
      created_at: now,
      updated_at: now,
    })
    if (error) return { ok: false as const, error: error.message }
  }

  await db.from('synapse_sessions').delete().eq('user_id', userId)

  await logPlatformEvent({
    actorId: admin.id,
    action: 'user.suspended',
    entityType: 'profile',
    entityId: userId,
    oldValue: { memberships: rows.map((r) => ({ id: r.id, status: r.status })) },
    metadata: { reason, role: guard.profile.role, mechanism: rows.length > 0 ? 'membership_status' : 'membership_marker' },
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

  const rows = await membershipRows(userId)
  const suspendedRows = rows.filter((r) => r.status === 'SUSPENDED')
  if (suspendedRows.length === 0) return { ok: false as const, error: 'Account is not suspended.' }
  const hierarchy = blockedByRoleHierarchy(admin.platformRole, rows)
  if (hierarchy) return { ok: false as const, error: hierarchy }
  if (suspendedRows.some((r) => !suspensionMetadataOf(r))) {
    // Suspended from Platform Access (control-plane membership only): reactivate it there,
    // where the membership role hierarchy and access audit apply.
    return { ok: false as const, error: 'This platform membership was suspended from Platform Access. Reactivate it there.' }
  }

  const now = new Date().toISOString()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  for (const row of suspendedRows) {
    const meta = suspensionMetadataOf(row)
    if (meta?.marker) {
      const { error } = await db.from('platform_memberships').delete().eq('id', row.id).eq('status', 'SUSPENDED')
      if (error) return { ok: false as const, error: error.message }
      continue
    }
    const rest = { ...(row.metadata ?? {}) }
    delete rest[ACCOUNT_SUSPENSION_METADATA_KEY]
    const { error } = await db
      .from('platform_memberships')
      .update({ status: meta?.previous_status ?? 'ACTIVE', metadata: rest, updated_at: now })
      .eq('id', row.id)
    if (error) return { ok: false as const, error: error.message }
  }

  await logPlatformEvent({
    actorId: admin.id,
    action: 'user.reactivated',
    entityType: 'profile',
    entityId: userId,
    oldValue: { memberships: suspendedRows.map((r) => ({ id: r.id, status: r.status })) },
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
  if (!guard.profile.is_deleted && !RESTORE_LIFTS_STATUSES.has(String(guard.profile.verification_status ?? '').toLowerCase())) {
    // Restore lifts an archive. A suspension (SUSPENDED membership) is lifted by Reactivate.
    return { ok: false as const, error: 'Account is not archived. Use Reactivate to lift a suspension.' }
  }

  // Restore lifts the archive (and any suspension marker) only. It must not
  // grant professional verification the identity never had, so a KYC state such
  // as 'pending' is preserved. Memberships, roles, MFA enrollment and the
  // must_change_password flag are untouched. Archive already revoked sessions,
  // so the restored user signs in again through the normal login + MFA path.
  const previousStatus = (guard.profile.verification_status ?? null) as string | null
  const liftStatus = previousStatus !== null && RESTORE_LIFTS_STATUSES.has(previousStatus.toLowerCase())
  const nextStatus = liftStatus ? 'verified' : previousStatus

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const { error } = await db
    .from('profiles')
    .update({
      is_deleted: false,
      ...(liftStatus ? { verification_status: nextStatus } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
  if (error) return { ok: false as const, error: error.message }
  await logPlatformEvent({
    actorId: admin.id,
    action: 'user.restored',
    entityType: 'profile',
    entityId: userId,
    oldValue: { is_deleted: Boolean(guard.profile.is_deleted), verification_status: previousStatus },
    metadata: { role: guard.profile.role, is_deleted: false, verification_status: nextStatus },
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
