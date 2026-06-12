// packages/auth/src/features.ts
// Feature gate guard — reads from subscription plan via has_feature() SQL function.
// Always enforce server-side. Never trust client-side feature flags alone.

import { supabaseAdmin } from '@synapse/db/admin'

export class FeatureGateError extends Error {
  readonly status = 402 as const
  constructor(feature: string) {
    super(`Feature '${feature}' is not enabled on this subscription.`)
    this.name = 'FeatureGateError'
  }
}

/**
 * Throws FeatureGateError (402) if the tenant's active subscription does not
 * include the requested feature. platform_admin tenants bypass all gates.
 */
export async function requireFeature(tenantId: string, feature: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const { data, error } = await db.rpc('has_feature', {
    p_tenant_id: tenantId,
    p_feature:   feature,
  }) as { data: boolean | null; error: { message: string } | null }

  if (error) throw new Error(`Feature check failed: ${error.message}`)
  if (!data) throw new FeatureGateError(feature)
}

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
