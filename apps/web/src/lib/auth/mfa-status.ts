/**
 * MFA status for web (clinical/platform) users. The source of truth is a
 * verified row in `mfa_enrollments`; `profiles` has no two_factor_enabled
 * column (that column exists only on `pharmacy_user_settings`). Only
 * `user_id` is ever selected here: never secrets or backup codes.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any

/** User ids with a verified MFA enrollment, or null when the lookup failed. */
export async function verifiedMfaUserIds(db: Db, userIds: string[]): Promise<Set<string> | null> {
  const ids = Array.from(new Set(userIds.filter(Boolean)))
  if (ids.length === 0) return new Set()
  try {
    const { data, error } = await db
      .from('mfa_enrollments')
      .select('user_id')
      .in('user_id', ids)
      .eq('verified', true)
    if (error || !Array.isArray(data)) return null
    return new Set(data.map((row: { user_id: string }) => row.user_id))
  } catch {
    return null
  }
}

/** Adds `two_factor_enabled` (null when unknown) to each row from mfa_enrollments. */
export async function withMfaStatus<T extends { id?: string | null }>(
  db: Db,
  rows: T[],
): Promise<Array<T & { two_factor_enabled: boolean | null }>> {
  const enrolled = await verifiedMfaUserIds(db, rows.map((row) => String(row.id ?? '')))
  return rows.map((row) => ({
    ...row,
    two_factor_enabled: enrolled ? enrolled.has(String(row.id ?? '')) : null,
  }))
}
