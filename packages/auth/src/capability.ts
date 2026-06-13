// packages/auth/src/capability.ts
// Server-side capability guard — enforces the tensor multitenancy lattice.
// Call requireCapability() in API routes and server actions AFTER getContext().

import { supabaseAdmin } from '@synapse/db/admin'
export class CapabilityError extends Error {
  readonly status = 403 as const
  constructor(message = 'Insufficient permissions') {
    super(message)
    this.name = 'CapabilityError'
  }
}

export async function requireCapability(
  payload:      { role: string },
  module:       string,
  resource:     string,
  action:       string,
  facilityType = 'any',
): Promise<void> {
  // platform_admin holds all capabilities
  if (payload.role === 'platform_admin') return

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const { data, error } = await db.rpc('has_capability', {
    p_role:          payload.role,
    p_facility_type: facilityType,
    p_module:        module,
    p_resource:      resource,
    p_action:        action,
  }) as { data: boolean | null; error: { message: string } | null }

  if (error) throw new Error(`Capability check failed: ${error.message}`)
  if (!data)  throw new CapabilityError()
}

/**
 * Boolean variant — no throw; useful for conditional rendering guards.
 */
export async function checkCapability(
  payload:      { role: string },
  module:       string,
  resource:     string,
  action:       string,
  facilityType = 'any',
): Promise<boolean> {
  try {
    await requireCapability(payload, module, resource, action, facilityType)
    return true
  } catch {
    return false
  }
}
