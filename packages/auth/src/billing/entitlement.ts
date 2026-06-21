// packages/auth/src/billing/entitlement.ts
// SINGLE SOURCE OF TRUTH for "is this tenant entitled to use the pharmacy module?".
//
// This file is intentionally PURE (no DB / no next/* imports) so it can be used
// from the Edge middleware as well as Node route handlers. The DB-backed wrapper
// `isTenantEntitled()` lives in subscription.ts (which already imports supabaseAdmin).
//
// Entitlement policy (a superset of the has_feature() SQL logic, extended to also
// honor current_period_end for active/trial as the task requires):
//   - active / trial / trialing : entitled, UNLESS the current period has ended
//                                 and the grace window (if any) has also passed.
//   - past_due                  : entitled ONLY while within grace_until.
//   - suspended / cancelled     : blocked.
//   - no subscription row       : entitled (fail-open / grandfather — see note).
//   - unknown status            : entitled (fail-open).
//
// Fail-open note: tenants without a subscription row (or with an unrecognized
// status) are NOT locked out. This avoids accidentally bricking tenants that were
// onboarded before billing existed. Only tenants with an explicit non-entitled
// status are blocked. This is a deliberate, documented assumption.

export const ENTITLED_STATUSES = ['active', 'trial', 'trialing'] as const
export const BLOCKED_STATUSES = ['past_due', 'suspended', 'cancelled', 'canceled'] as const

export type EntitlementInput = {
  status?: string | null
  current_period_end?: string | null
  grace_until?: string | null
}

export type EntitlementResult = {
  entitled: boolean
  /** machine-readable reason code (for logging / debugging) */
  reason: string
  /** the raw subscription status that was evaluated (null when no row) */
  status: string | null
}

export function evaluateEntitlement(
  input: EntitlementInput | null | undefined,
  now: Date = new Date(),
): EntitlementResult {
  const status = input?.status ?? null

  // No subscription row at all → fail-open (grandfather existing tenants).
  if (!status) return { entitled: true, reason: 'no_subscription_row', status: null }

  const s = status.toLowerCase()
  const periodEnd = input?.current_period_end ? new Date(input.current_period_end) : null
  const grace = input?.grace_until ? new Date(input.grace_until) : null
  const withinGrace = grace != null && !Number.isNaN(grace.getTime()) && now <= grace
  const periodEnded =
    periodEnd != null && !Number.isNaN(periodEnd.getTime()) && now > periodEnd

  if (s === 'active' || s === 'trial' || s === 'trialing') {
    if (periodEnded) {
      return withinGrace
        ? { entitled: true, reason: 'period_ended_within_grace', status }
        : { entitled: false, reason: 'period_ended', status }
    }
    return { entitled: true, reason: 'active', status }
  }

  if (s === 'past_due') {
    return withinGrace
      ? { entitled: true, reason: 'past_due_within_grace', status }
      : { entitled: false, reason: 'past_due', status }
  }

  if (s === 'suspended' || s === 'cancelled' || s === 'canceled') {
    return { entitled: false, reason: s, status }
  }

  // Unknown / future status → fail-open rather than locking the tenant out.
  return { entitled: true, reason: 'unknown_status_failopen', status }
}
