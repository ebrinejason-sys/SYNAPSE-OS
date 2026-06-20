// packages/auth/src/features.ts
// Feature gate guard — reads from subscription plan via has_feature() SQL function.
// Always enforce server-side. Never trust client-side feature flags alone.

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@synapse/db/admin'
import { getSubscriptionStatus } from './billing/subscription'

export class FeatureGateError extends Error {
  readonly status = 402 as const
  readonly feature: string
  readonly subscriptionStatus?: string
  readonly reactivateUrl?: string

  constructor(feature: string, extras?: { subscriptionStatus?: string; reactivateUrl?: string }) {
    super(`Feature '${feature}' is not enabled on this subscription.`)
    this.name = 'FeatureGateError'
    this.feature = feature
    this.subscriptionStatus = extras?.subscriptionStatus
    this.reactivateUrl = extras?.reactivateUrl ?? '/billing'
  }
}

async function rpcHasFeature(tenantId: string, feature: string): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const { data, error } = (await db.rpc('has_feature', {
    p_tenant_id: tenantId,
    p_feature: feature,
  })) as { data: boolean | null; error: { message: string } | null }

  if (error) throw new Error(`Feature check failed: ${error.message}`)
  return Boolean(data)
}

/**
 * Throws FeatureGateError (402) if the tenant's subscription does not include the feature.
 */
export async function requireFeature(tenantId: string, feature: string): Promise<void> {
  const ok = await rpcHasFeature(tenantId, feature)
  if (!ok) {
    const sub = await getSubscriptionStatus(tenantId)
    throw new FeatureGateError(feature, { subscriptionStatus: sub?.status })
  }
}

/** Alias matching build doctrine naming. */
export const requireActiveSubscription = requireFeature

/**
 * Boolean variant — no throw. Use for conditional rendering and soft gates.
 */
export async function checkFeature(tenantId: string, feature: string): Promise<boolean> {
  try {
    await requireFeature(tenantId, feature)
    return true
  } catch {
    return false
  }
}

/** Standard 402 JSON response for API routes. */
export function subscriptionRequiredResponse(err: FeatureGateError) {
  return NextResponse.json(
    {
      error: 'subscription_required',
      message: err.message,
      feature: err.feature,
      status: err.subscriptionStatus ?? 'unknown',
      reactivate_url: err.reactivateUrl ?? '/billing',
    },
    { status: 402 },
  )
}

/** Wrap requireFeature in API handlers. */
export async function gateFeature(tenantId: string, feature: string): Promise<NextResponse | null> {
  try {
    await requireFeature(tenantId, feature)
    return null
  } catch (e) {
    if (e instanceof FeatureGateError) return subscriptionRequiredResponse(e)
    throw e
  }
}
