import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  LocalStorageSyncOutboxStore,
  parkHospitalClinicalOutbox,
  restoreParkedHospitalClinicalOutbox,
} from './local-storage-outbox-store'

const TENANT_A = '94ec9fd8-17ac-4f40-8f82-429d44cb8b02'
const ACTOR_A = '389ee4bb-4708-4f83-af6f-58c3c4253b9c'
const TENANT_B = 'ab239578-7f7a-4fdc-af1e-bfdaf1a77847'
const ACTOR_B = 'a1111111-1111-4111-8111-111111111101'
const WRAP_A = Buffer.from('wrap-material-actor-a-32-bytes!!').toString('base64')
const WRAP_B = Buffer.from('wrap-material-actor-b-32-bytes!!').toString('base64')

function memoryStorage(): Storage {
  const map = new Map<string, string>()
  return {
    get length() {
      return map.size
    },
    clear() {
      map.clear()
    },
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null
    },
    key(index: number) {
      return [...map.keys()][index] ?? null
    },
    removeItem(key: string) {
      map.delete(key)
    },
    setItem(key: string, value: string) {
      map.set(key, value)
    },
  }
}

function command(actorId = ACTOR_A, tenantId = TENANT_A) {
  return {
    commandId: 'cmd-writeup-1',
    commandType: 'clinical.encounter.writeup.v1',
    schemaVersion: 1,
    tenantId,
    facilityId: 'fac-a',
    deviceId: 'dev-1',
    actorId,
    aggregateType: 'encounter',
    aggregateId: 'enc-1',
    baseRevision: null,
    capturedAtClient: '2026-09-13T12:00:00.000Z',
    payload: { encounter_id: 'enc-1', writeup: { hpi: 'secret fever note' } },
    payloadHash: 'hash-1',
    correlationId: 'enc-1',
  }
}

describe('parked outbox wrap', () => {
  beforeEach(() => {
    const ls = memoryStorage()
    const ss = memoryStorage()
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { localStorage: ls, sessionStorage: ss, crypto },
    })
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: ls })
    Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: ss })
  })

  afterEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).window
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).localStorage
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).sessionStorage
  })

  it('parks ciphertext only and restores for the same wrap material', async () => {
    const store = new LocalStorageSyncOutboxStore(TENANT_A, ACTOR_A)
    await store.initialize()
    await store.persist(command() as never)

    const parked = await parkHospitalClinicalOutbox(TENANT_A, ACTOR_A, WRAP_A)
    expect(parked.parked).toBe(1)
    expect(parked.wrapped).toBe(true)

    const parkRaw = window.localStorage.getItem(parked.parkKey)
    expect(parkRaw).toBeTruthy()
    expect(parkRaw).not.toContain('secret fever note')
    expect(parkRaw).not.toContain('keyMaterial')
    const blob = JSON.parse(parkRaw as string)
    expect(blob.wrap).toBeTruthy()
    expect(blob.wrapIv).toBeTruthy()
    expect(window.sessionStorage.getItem('synapse.hospital.clinical.sessionKey.v1')).toBeNull()

    const restored = await restoreParkedHospitalClinicalOutbox(TENANT_A, ACTOR_A, WRAP_A)
    expect(restored.restored).toBe(1)
    const again = new LocalStorageSyncOutboxStore(TENANT_A, ACTOR_A)
    await again.initialize()
    const row = await again.get('cmd-writeup-1')
    expect(row?.command.payload).toMatchObject({ writeup: { hpi: 'secret fever note' } })
  })

  it('does not restore for another actor wrap material', async () => {
    const store = new LocalStorageSyncOutboxStore(TENANT_A, ACTOR_A)
    await store.initialize()
    await store.persist(command() as never)
    await parkHospitalClinicalOutbox(TENANT_A, ACTOR_A, WRAP_A)

    const other = await restoreParkedHospitalClinicalOutbox(TENANT_A, ACTOR_A, WRAP_B)
    expect(other.restored).toBe(0)
    expect(window.localStorage.getItem(`synapse.hospital.clinical.parked.v2:${TENANT_A}:${ACTOR_A}`)).toBeTruthy()
  })

  it('does not restore across facilities / tenants', async () => {
    const store = new LocalStorageSyncOutboxStore(TENANT_A, ACTOR_A)
    await store.initialize()
    await store.persist(command() as never)
    await parkHospitalClinicalOutbox(TENANT_A, ACTOR_A, WRAP_A)

    const cross = await restoreParkedHospitalClinicalOutbox(TENANT_B, ACTOR_B, WRAP_A)
    expect(cross.restored).toBe(0)
  })
})
