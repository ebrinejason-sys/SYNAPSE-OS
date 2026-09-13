'use client'

import {
  parkHospitalClinicalQueueForUser,
  rememberHospitalClinicalContext,
  type HospitalClinicalSyncContext,
} from './hospital-clinical-sync'

/**
 * Park pending encrypted outbox for the current actor, then revoke the session.
 * Park stores ciphertext + HMAC-wrapped session key. Another signed-in user
 * receives different wrap material and cannot unwrap or flush those drafts.
 */
export async function signOutHospitalClinical(syncContext?: HospitalClinicalSyncContext | null): Promise<void> {
  let ctx = syncContext ?? null
  if (!ctx?.tenantId || !ctx.actorId || !ctx.outboxWrapMaterial) {
    try {
      const res = await fetch('/api/hospital/sync/context', { cache: 'no-store' })
      if (res.ok) {
        const body = (await res.json()) as { syncContext?: HospitalClinicalSyncContext }
        ctx = body.syncContext ?? ctx
      }
    } catch {
      // keep whatever identity we already had
    }
  }
  if (ctx?.tenantId && ctx.actorId) {
    rememberHospitalClinicalContext(ctx)
    await parkHospitalClinicalQueueForUser(ctx)
  }
  await fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined)
}
