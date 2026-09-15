'use client'

/**
 * Last-known write-up GET payload + local draft, scoped by encounter/tenant/actor
 * and encrypted with the session AES key. A disconnected reload can render the
 * form without /api. Another actor cannot decrypt (wrong session key / wrap).
 */
import { decryptJsonBlob, encryptJsonBlob } from './local-storage-outbox-store'

const PREFIX = 'synapse.hospital.clinical.writeup-draft.v1'

export type WriteupDraftSnapshot = {
  encounterId: string
  tenantId: string
  actorId: string
  savedAt: string
  payload: unknown
  draft: unknown
  notice?: string | null
}

type StoredSnap = {
  version: 1
  encounterId: string
  tenantId: string
  actorId: string
  savedAt: string
  cipher: string
  iv: string
}

export function draftSnapshotKey(tenantId: string, actorId: string, encounterId: string): string {
  return `${PREFIX}:${tenantId}:${actorId}:${encounterId}`
}

export async function saveWriteupDraftSnapshot(snap: WriteupDraftSnapshot): Promise<void> {
  if (typeof window === 'undefined' || !window.localStorage) return
  const { cipher, iv } = await encryptJsonBlob({
    payload: snap.payload,
    draft: snap.draft,
    notice: snap.notice ?? null,
  })
  const stored: StoredSnap = {
    version: 1,
    encounterId: snap.encounterId,
    tenantId: snap.tenantId,
    actorId: snap.actorId,
    savedAt: snap.savedAt,
    cipher,
    iv,
  }
  window.localStorage.setItem(draftSnapshotKey(snap.tenantId, snap.actorId, snap.encounterId), JSON.stringify(stored))
}

export async function readWriteupDraftSnapshot(
  tenantId: string,
  actorId: string,
  encounterId: string,
): Promise<WriteupDraftSnapshot | null> {
  if (typeof window === 'undefined' || !window.localStorage) return null
  try {
    const raw = window.localStorage.getItem(draftSnapshotKey(tenantId, actorId, encounterId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredSnap & Partial<WriteupDraftSnapshot>
    if (parsed.tenantId !== tenantId || parsed.actorId !== actorId || parsed.encounterId !== encounterId) {
      return null
    }
    if (!parsed.cipher || !parsed.iv) {
      // Refuse plaintext snapshots.
      window.localStorage.removeItem(draftSnapshotKey(tenantId, actorId, encounterId))
      return null
    }
    const inner = await decryptJsonBlob<{ payload: unknown; draft: unknown; notice?: string | null }>(
      parsed.cipher,
      parsed.iv,
    )
    return {
      encounterId,
      tenantId,
      actorId,
      savedAt: parsed.savedAt,
      payload: inner.payload,
      draft: inner.draft,
      notice: inner.notice,
    }
  } catch {
    return null
  }
}

export function clearWriteupDraftSnapshot(tenantId: string, actorId: string, encounterId: string): void {
  if (typeof window === 'undefined' || !window.localStorage) return
  window.localStorage.removeItem(draftSnapshotKey(tenantId, actorId, encounterId))
}
