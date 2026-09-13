'use client'

import {
  parkHospitalClinicalQueueForUser,
  type HospitalClinicalSyncContext,
} from './hospital-clinical-sync'

/**
 * Park pending encrypted outbox for the current actor, then revoke the session.
 * Prefer calling with syncContext from /api/hospital/sync/context when available.
 */
export async function signOutHospitalClinical(syncContext?: HospitalClinicalSyncContext | null): Promise<void> {
  if (syncContext?.tenantId && syncContext.actorId) {
    parkHospitalClinicalQueueForUser(syncContext)
  } else {
    try {
      const res = await fetch('/api/hospital/sync/context', { cache: 'no-store' })
      if (res.ok) {
        const body = (await res.json()) as { syncContext?: HospitalClinicalSyncContext }
        if (body.syncContext) parkHospitalClinicalQueueForUser(body.syncContext)
      }
    } catch {
      // Best-effort park; still logout.
    }
  }
  await fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined)
}
