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

export type ManualGrantInput = {
  id: string
  planSlug?: string | null
  planName?: string | null
  starts_at: string
  ends_at: string
  status: string
  reason?: string | null
}

export type EffectiveSubscription = EntitlementResult & {
  source: 'PAID' | 'MANUAL_GRANT' | 'TRIAL' | 'GRACE' | 'EXPIRED' | 'NONE'
  planSlug: string | null
  planName: string | null
  startsAt: string | null
  endsAt: string | null
  daysRemaining: number | null
  grantId: string | null
  overrideReason: string | null
  paymentStatus: 'PAID' | 'NOT_REQUIRED' | 'NONE'
}

export function resolveEffectiveSubscription(
  paid: (EntitlementInput & { planSlug?: string | null; planName?: string | null; trial_ends?: string | null }) | null | undefined,
  grants: ManualGrantInput[] = [],
  now: Date = new Date(),
): EffectiveSubscription {
  const activeGrant = grants
    .filter((grant) => grant.status !== 'REVOKED' && grant.status !== 'CANCELLED')
    .filter((grant) => new Date(grant.starts_at) <= now && now < new Date(grant.ends_at))
    .sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime())[0]
  if (activeGrant) {
    const end = new Date(activeGrant.ends_at)
    return {
      entitled: true,
      reason: 'manual_grant',
      status: 'active',
      source: 'MANUAL_GRANT',
      planSlug: activeGrant.planSlug ?? null,
      planName: activeGrant.planName ?? null,
      startsAt: activeGrant.starts_at,
      endsAt: activeGrant.ends_at,
      daysRemaining: Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 86400000)),
      grantId: activeGrant.id,
      overrideReason: activeGrant.reason ?? null,
      paymentStatus: 'NOT_REQUIRED',
    }
  }
  const evaluated = evaluateEntitlement(paid, now)
  const end = paid?.current_period_end ?? paid?.trial_ends ?? null
  const source: EffectiveSubscription['source'] = !paid?.status
    ? 'NONE'
    : evaluated.entitled
      ? paid.status.toLowerCase() === 'trial' || paid.status.toLowerCase() === 'trialing' ? 'TRIAL' : paid.status.toLowerCase() === 'past_due' ? 'GRACE' : 'PAID'
    : paid?.status ? 'EXPIRED' : 'NONE'
  return {
    ...evaluated,
    source,
    planSlug: paid?.planSlug ?? null,
    planName: paid?.planName ?? null,
    startsAt: null,
    endsAt: end,
    daysRemaining: end ? Math.max(0, Math.ceil((new Date(end).getTime() - now.getTime()) / 86400000)) : null,
    grantId: null,
    overrideReason: null,
    paymentStatus: source === 'PAID' || source === 'GRACE' ? 'PAID' : 'NONE',
  }
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
