import { afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const {
  requireHospitalStaffContext,
  requireHospitalCapability,
  logHospitalAudit,
  dbFrom,
  hashPayload,
  assertSyncCommand,
  toSyncOutboxRow,
  applyWriteupSyncCommand,
  applyDispositionSyncCommand,
  composeClinicalNote,
  writeupFromEncounterMetadata,
} = vi.hoisted(() => ({
  requireHospitalStaffContext: vi.fn(),
  requireHospitalCapability: vi.fn(),
  logHospitalAudit: vi.fn(),
  dbFrom: vi.fn(),
  hashPayload: vi.fn(),
  assertSyncCommand: vi.fn(),
  toSyncOutboxRow: vi.fn(),
  applyWriteupSyncCommand: vi.fn(),
  applyDispositionSyncCommand: vi.fn(),
  composeClinicalNote: vi.fn(),
  writeupFromEncounterMetadata: vi.fn(),
}))

vi.mock('@/lib/hospital-dept', () => ({
  requireHospitalStaffContext: (...args: unknown[]) => requireHospitalStaffContext(...args),
}))

vi.mock('@/lib/hospital-shared', async () => {
  const { NextResponse } = await import('next/server')
  return {
    isContextError: (value: unknown): value is InstanceType<typeof NextResponse> =>
      value instanceof NextResponse,
    requireHospitalCapability: (...args: unknown[]) => requireHospitalCapability(...args),
    logHospitalAudit: (...args: unknown[]) => logHospitalAudit(...args),
  }
})

vi.mock('@synapse/db/admin', () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => dbFrom(...args),
  },
}))

vi.mock('@synapse/db/sync-contract', () => ({
  assertSyncCommand: (...args: unknown[]) => assertSyncCommand(...args),
  hashPayload: (...args: unknown[]) => hashPayload(...args),
  toSyncOutboxRow: (...args: unknown[]) => toSyncOutboxRow(...args),
}))

vi.mock('@synapse/db/clinical-offline-writeup', () => ({
  CLINICAL_WRITEUP_COMMAND: 'clinical.encounter.writeup.v1',
  applyWriteupSyncCommand: (...args: unknown[]) => applyWriteupSyncCommand(...args),
}))

vi.mock('@synapse/db/clinical-offline-disposition', () => ({
  CLINICAL_DISPOSITION_COMMAND: 'clinical.encounter.disposition.v1',
  applyDispositionSyncCommand: (...args: unknown[]) => applyDispositionSyncCommand(...args),
  isClinicalDisposition: (value: string) =>
    [
      'LOCAL_PHARMACY',
      'EXTERNAL_PHARMACY',
      'NO_MEDICATION',
      'FURTHER_LAB',
      'REFERRAL',
      'FOLLOW_UP',
      'CLINICAL_COMPLETE',
    ].includes(value),
}))

vi.mock('@synapse/db/clinical-writeup', () => ({
  composeClinicalNote: (...args: unknown[]) => composeClinicalNote(...args),
  writeupFromEncounterMetadata: (...args: unknown[]) => writeupFromEncounterMetadata(...args),
}))

const TENANT = '11111111-1111-4111-8111-111111111111'
const USER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const ENCOUNTER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const FACILITY = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const OUTBOX = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const CMD = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'

function makeCommand(overrides: Record<string, unknown> = {}) {
  return {
    commandId: CMD,
    commandType: 'clinical.encounter.writeup.v1',
    schemaVersion: 1,
    tenantId: TENANT,
    facilityId: FACILITY,
    deviceId: 'device-1',
    actorId: USER,
    aggregateType: 'encounter',
    aggregateId: ENCOUNTER,
    baseRevision: null,
    capturedAtClient: '2026-09-12T20:00:00.000Z',
    payload: {
      encounter_id: ENCOUNTER,
      writeup: { hpi: 'Offline fever x2d', assessment: 'Viral URI', plan: 'Supportive' },
    },
    payloadHash: 'hash-ok',
    correlationId: ENCOUNTER,
    ...overrides,
  }
}

function makeRequest(body: unknown) {
  return new NextRequest('https://synapseos.tech/api/hospital/sync/apply', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function chain(result: { data?: unknown; error?: unknown; code?: string }) {
  const api: Record<string, unknown> = {}
  const self = () => api
  for (const m of [
    'select',
    'insert',
    'update',
    'eq',
    'maybeSingle',
    'single',
  ]) {
    api[m] = vi.fn(self)
  }
  api.maybeSingle = vi.fn(async () => ({ data: result.data ?? null, error: result.error ?? null }))
  api.single = vi.fn(async () => ({
    data: result.data ?? null,
    error: result.error ?? (result.data ? null : { message: 'not found', code: result.code }),
  }))
  // updates/inserts often await the builder directly in some routes; support both
  api.then = undefined
  return api
}

describe('POST /api/hospital/sync/apply', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('denies unauthenticated callers', async () => {
    const denied = NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    requireHospitalStaffContext.mockResolvedValue(denied)

    const { POST } = await import('./route')
    const res = await POST(makeRequest({ command: makeCommand() }))
    expect(res).toBe(denied)
    expect(requireHospitalCapability).not.toHaveBeenCalled()
  })

  it('rejects unsupported command types', async () => {
    requireHospitalStaffContext.mockResolvedValue({
      tenantId: TENANT,
      userId: USER,
      hospitalId: FACILITY,
    })
    requireHospitalCapability.mockResolvedValue(null)
    assertSyncCommand.mockImplementation(() => undefined)
    hashPayload.mockResolvedValue('hash-ok')

    const { POST } = await import('./route')
    const res = await POST(
      makeRequest({
        command: makeCommand({ commandType: 'pharmacy.sale.complete.v1', aggregateType: 'pharmacy_sale' }),
      }),
    )
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/Unsupported/i)
  })

  it('rejects tenant/actor scope mismatch', async () => {
    requireHospitalStaffContext.mockResolvedValue({
      tenantId: TENANT,
      userId: USER,
      hospitalId: FACILITY,
    })
    requireHospitalCapability.mockResolvedValue(null)
    assertSyncCommand.mockImplementation(() => undefined)
    hashPayload.mockResolvedValue('hash-ok')

    const { POST } = await import('./route')
    const res = await POST(makeRequest({ command: makeCommand({ actorId: 'other-user' }) }))
    expect(res.status).toBe(403)
  })

  it('rejects invalid payload hash', async () => {
    requireHospitalStaffContext.mockResolvedValue({
      tenantId: TENANT,
      userId: USER,
      hospitalId: FACILITY,
    })
    requireHospitalCapability.mockResolvedValue(null)
    assertSyncCommand.mockImplementation(() => undefined)
    hashPayload.mockResolvedValue('different-hash')

    const { POST } = await import('./route')
    const res = await POST(makeRequest({ command: makeCommand() }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('SYNC_PAYLOAD_HASH_INVALID')
  })

  it('applies write-up, persists outbox, and audits', async () => {
    requireHospitalStaffContext.mockResolvedValue({
      tenantId: TENANT,
      userId: USER,
      hospitalId: FACILITY,
    })
    requireHospitalCapability.mockResolvedValue(null)
    assertSyncCommand.mockImplementation(() => undefined)
    hashPayload.mockResolvedValue('hash-ok')
    toSyncOutboxRow.mockReturnValue({ idempotency_key: CMD })
    applyWriteupSyncCommand.mockReturnValue({
      encounterId: ENCOUNTER,
      metadata: { writeup: { hpi: 'Offline fever x2d' } },
      revision: 1,
    })
    writeupFromEncounterMetadata.mockReturnValue({ hpi: 'Offline fever x2d' })
    composeClinicalNote.mockReturnValue('HPI: Offline fever x2d')
    logHospitalAudit.mockResolvedValue(undefined)

    const findChain = chain({ data: null })
    const insertChain = chain({
      data: {
        id: OUTBOX,
        tenant_id: TENANT,
        idempotency_key: CMD,
        payload: {},
        status: 'queued',
        applied_at: null,
        conflict_reason: null,
      },
    })
    const syncingChain = chain({ data: null })
    const encounterChain = chain({
      data: {
        id: ENCOUNTER,
        metadata: {},
        is_signed: false,
        chief_complaint: 'Fever',
        status: 'open',
      },
    })
    const updateEncounterChain = chain({ data: null })
    const appliedChain = chain({ data: null })

    let fromCall = 0
    dbFrom.mockImplementation((table: string) => {
      fromCall += 1
      if (table === 'offline_mutation_outbox') {
        // 1 find, 2 insert, 3 syncing update, 4 applied update
        if (fromCall === 1) return findChain
        if (fromCall === 2) return insertChain
        if (fromCall === 3) return syncingChain
        return appliedChain
      }
      if (table === 'encounters') {
        if (fromCall === 4 || encounterChain.select.mock.calls.length === 0) {
          // first encounters call is select; second is update — track via select calls
        }
        return encounterChain.select.mock.calls.length === 0 ? encounterChain : updateEncounterChain
      }
      return chain({ data: null })
    })

    // More reliable table routing
    let outboxOps = 0
    let encounterOps = 0
    dbFrom.mockImplementation((table: string) => {
      if (table === 'offline_mutation_outbox') {
        outboxOps += 1
        if (outboxOps === 1) return findChain
        if (outboxOps === 2) return insertChain
        if (outboxOps === 3) return syncingChain
        return appliedChain
      }
      if (table === 'encounters') {
        encounterOps += 1
        if (encounterOps === 1) return encounterChain
        return updateEncounterChain
      }
      return chain({ data: null })
    })

    const { POST } = await import('./route')
    const res = await POST(makeRequest({ command: makeCommand() }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.outcome).toBe('applied')
    expect(json.commandId).toBe(CMD)
    expect(json.result.encounterId).toBe(ENCOUNTER)
    expect(applyWriteupSyncCommand).toHaveBeenCalled()
    expect(logHospitalAudit).toHaveBeenCalled()
  })

  it('replays an already-applied command idempotently', async () => {
    requireHospitalStaffContext.mockResolvedValue({
      tenantId: TENANT,
      userId: USER,
      hospitalId: FACILITY,
    })
    requireHospitalCapability.mockResolvedValue(null)
    assertSyncCommand.mockImplementation(() => undefined)
    hashPayload.mockResolvedValue('hash-ok')

    const prior = makeCommand()
    const findChain = chain({
      data: {
        id: OUTBOX,
        tenant_id: TENANT,
        idempotency_key: CMD,
        payload: { envelope: prior, serverResponse: { encounterId: ENCOUNTER, revision: 1 } },
        status: 'applied',
        applied_at: '2026-09-12T19:00:00.000Z',
        conflict_reason: null,
      },
    })
    dbFrom.mockImplementation(() => findChain)

    const { POST } = await import('./route')
    const res = await POST(makeRequest({ command: makeCommand() }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.outcome).toBe('replay')
    expect(applyWriteupSyncCommand).not.toHaveBeenCalled()
  })

  it('conflicts when the same commandId has a different payload hash', async () => {
    requireHospitalStaffContext.mockResolvedValue({
      tenantId: TENANT,
      userId: USER,
      hospitalId: FACILITY,
    })
    requireHospitalCapability.mockResolvedValue(null)
    assertSyncCommand.mockImplementation(() => undefined)
    hashPayload.mockResolvedValue('hash-ok')

    const prior = makeCommand({ payloadHash: 'other-hash' })
    const findChain = chain({
      data: {
        id: OUTBOX,
        tenant_id: TENANT,
        idempotency_key: CMD,
        payload: { envelope: prior },
        status: 'applied',
        applied_at: '2026-09-12T19:00:00.000Z',
        conflict_reason: null,
      },
    })
    dbFrom.mockImplementation(() => findChain)

    const { POST } = await import('./route')
    const res = await POST(makeRequest({ command: makeCommand() }))
    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json.outcome).toBe('conflict')
  })

  it('rejects sync against a signed encounter', async () => {
    requireHospitalStaffContext.mockResolvedValue({
      tenantId: TENANT,
      userId: USER,
      hospitalId: FACILITY,
    })
    requireHospitalCapability.mockResolvedValue(null)
    assertSyncCommand.mockImplementation(() => undefined)
    hashPayload.mockResolvedValue('hash-ok')
    toSyncOutboxRow.mockReturnValue({ idempotency_key: CMD })

    const findChain = chain({ data: null })
    const insertChain = chain({
      data: {
        id: OUTBOX,
        tenant_id: TENANT,
        idempotency_key: CMD,
        payload: {},
        status: 'queued',
        applied_at: null,
        conflict_reason: null,
      },
    })
    const syncingChain = chain({ data: null })
    const encounterChain = chain({
      data: {
        id: ENCOUNTER,
        metadata: {},
        is_signed: true,
        chief_complaint: 'Fever',
        status: 'closed',
      },
    })
    const rejectChain = chain({ data: null })

    let outboxOps = 0
    dbFrom.mockImplementation((table: string) => {
      if (table === 'offline_mutation_outbox') {
        outboxOps += 1
        if (outboxOps === 1) return findChain
        if (outboxOps === 2) return insertChain
        if (outboxOps === 3) return syncingChain
        return rejectChain
      }
      return encounterChain
    })

    const { POST } = await import('./route')
    const res = await POST(makeRequest({ command: makeCommand() }))
    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json.reason).toBe('ENCOUNTER_SIGNED_IMMUTABLE')
  })

  it('applies disposition SyncCommand', async () => {
    requireHospitalStaffContext.mockResolvedValue({
      tenantId: TENANT,
      userId: USER,
      hospitalId: FACILITY,
    })
    requireHospitalCapability.mockResolvedValue(null)
    assertSyncCommand.mockImplementation(() => undefined)
    hashPayload.mockResolvedValue('hash-ok')
    toSyncOutboxRow.mockReturnValue({ idempotency_key: CMD })
    applyDispositionSyncCommand.mockReturnValue({
      encounterId: ENCOUNTER,
      disposition: 'CLINICAL_COMPLETE',
      dispositionReason: 'Offline complete',
      dispositionBy: USER,
      dispositionAt: '2026-09-12T21:00:00.000Z',
      isSigned: false,
      revision: 1,
    })
    logHospitalAudit.mockResolvedValue(undefined)

    const findChain = chain({ data: null })
    const insertChain = chain({
      data: {
        id: OUTBOX,
        tenant_id: TENANT,
        idempotency_key: CMD,
        payload: {},
        status: 'queued',
        applied_at: null,
        conflict_reason: null,
      },
    })
    const syncingChain = chain({ data: null })
    const encounterChain = chain({
      data: {
        id: ENCOUNTER,
        metadata: {},
        is_signed: false,
        chief_complaint: 'Fever',
        status: 'in_progress',
        disposition: null,
        disposition_reason: null,
        disposition_by: null,
        disposition_at: null,
      },
    })
    const updateEncounterChain = chain({ data: null })
    const appliedChain = chain({ data: null })

    let outboxOps = 0
    let encounterOps = 0
    dbFrom.mockImplementation((table: string) => {
      if (table === 'offline_mutation_outbox') {
        outboxOps += 1
        if (outboxOps === 1) return findChain
        if (outboxOps === 2) return insertChain
        if (outboxOps === 3) return syncingChain
        return appliedChain
      }
      if (table === 'encounters') {
        encounterOps += 1
        if (encounterOps === 1) return encounterChain
        return updateEncounterChain
      }
      return chain({ data: null })
    })

    const { POST } = await import('./route')
    const res = await POST(
      makeRequest({
        command: makeCommand({
          commandType: 'clinical.encounter.disposition.v1',
          payload: {
            encounter_id: ENCOUNTER,
            disposition: 'CLINICAL_COMPLETE',
            reason: 'Offline complete',
          },
        }),
      }),
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.outcome).toBe('applied')
    expect(json.result.disposition).toBe('CLINICAL_COMPLETE')
    expect(applyDispositionSyncCommand).toHaveBeenCalled()
    expect(applyWriteupSyncCommand).not.toHaveBeenCalled()
  })

})
