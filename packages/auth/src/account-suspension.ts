// packages/auth/src/account-suspension.ts
//
// Account-level suspension WITHOUT a schema change.
//
// profiles.verification_status is constrained to pending/under_review/verified/rejected
// (it is the professional-verification state), so suspension can never be written there.
// Instead an account is suspended when it has a platform_memberships row with
// status = 'SUSPENDED' (a status the table already allows):
//   - control-plane users: their existing membership row is set to SUSPENDED and the
//     previous status is kept in metadata.account_suspension.previous_status;
//   - everyone else: a marker row is inserted (status SUSPENDED, lowest platform role,
//     metadata.account_suspension.marker = true). A SUSPENDED row never grants access,
//     the marker is hidden from Platform Access, and unsuspend deletes it.
// Every login gate, session creation and getContext read this same marker.

import { supabaseAdmin } from '@synapse/db/admin'

export const ACCOUNT_SUSPENSION_METADATA_KEY = 'account_suspension'
/** Platform role written on marker rows. The row is SUSPENDED, so the role grants nothing. */
export const ACCOUNT_SUSPENSION_MARKER_ROLE = 'READ_ONLY_OBSERVER'

export class AccountSuspendedError extends Error {
  constructor() {
    super('ACCOUNT_SUSPENDED')
    this.name = 'AccountSuspendedError'
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = { from(table: string): any }

export type AccountSuspensionMetadata = {
  marker?: boolean
  previous_status?: string | null
  suspended_at?: string
  suspended_by?: string
  reason?: string
}

export function suspensionMetadataOf(row: { metadata?: unknown } | null | undefined): AccountSuspensionMetadata | null {
  const meta = row?.metadata
  if (!meta || typeof meta !== 'object') return null
  const value = (meta as Record<string, unknown>)[ACCOUNT_SUSPENSION_METADATA_KEY]
  return value && typeof value === 'object' ? (value as AccountSuspensionMetadata) : null
}

/** True when this membership row only exists to mark an account suspension. */
export function isAccountSuspensionMarker(row: { metadata?: unknown } | null | undefined): boolean {
  return suspensionMetadataOf(row)?.marker === true
}

/**
 * Is the account suspended? Fails closed: a lookup error throws, so login gates
 * deny (500) rather than silently admitting a possibly-suspended account.
 */
export async function isAccountSuspended(userId: string | null | undefined, db: Db = supabaseAdmin as unknown as Db): Promise<boolean> {
  if (!userId) return false
  const { data, error } = await db
    .from('platform_memberships')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'SUSPENDED')
    .limit(1)
  if (error) throw new Error(`[SYNAPSE] account suspension lookup failed: ${error.message ?? 'unknown'}`)
  return Array.isArray(data) && data.length > 0
}

/** Adds `membership_suspended` so classifyAccountState / isAccountActivated see suspension. */
export async function withMembershipSuspension<T extends { id?: unknown }>(
  profile: T,
  db?: Db,
): Promise<T & { membership_suspended: boolean }> {
  const id = typeof profile.id === 'string' ? profile.id : null
  return { ...profile, membership_suspended: await isAccountSuspended(id, db) }
}

/** User ids (optionally restricted to `ids`) that are currently suspended. */
export async function suspendedUserIds(db: Db = supabaseAdmin as unknown as Db, ids?: string[]): Promise<string[]> {
  let query = db.from('platform_memberships').select('user_id').eq('status', 'SUSPENDED')
  if (ids) {
    if (ids.length === 0) return []
    query = query.in('user_id', ids)
  }
  const { data, error } = await query.limit(10000)
  if (error) throw new Error(`[SYNAPSE] account suspension lookup failed: ${error.message ?? 'unknown'}`)
  return Array.from(new Set(((data ?? []) as Array<{ user_id: string }>).map((r) => r.user_id)))
}
