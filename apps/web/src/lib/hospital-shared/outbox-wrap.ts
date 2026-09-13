import 'server-only'

import { createHmac } from 'node:crypto'

/**
 * Actor-bound wrap material for parked clinical outbox.
 * HMAC-SHA256(server secret, tenant|actor) — another signed-in user gets a
 * different material from GET /api/hospital/sync/context and cannot unwrap.
 * Never persist this value in localStorage.
 */
export function hospitalOutboxWrapMaterial(tenantId: string, actorId: string): string | null {
  const secret =
    process.env.SYNAPSE_JWT_SECRET?.trim() || process.env.SYNAPSE_OUTBOX_WRAP_SECRET?.trim() || ''
  if (!tenantId || !actorId || secret.length < 16) return null
  return createHmac('sha256', secret)
    .update(`synapse.hospital.clinical.wrap.v1|${tenantId}|${actorId}`)
    .digest('base64')
}
