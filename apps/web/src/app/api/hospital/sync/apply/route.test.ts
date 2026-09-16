import { afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const {
  requireHospitalStaffContext,
  requireHospitalCapability,
  logHospitalAudit,
  requireHospitalAudit,
  HospitalAuditRequiredError,
  dbFrom,
  hashPayload,
  assertSyncCommand,
  toSyncOutboxRow,
  applyWriteupSyncCommand,
  applyDispositionSyncCommand,
  applyTriageSyncCommand,
  triageFromEncounterMetadata,
  vitalsInsertFromTriage,
  applyPrescribeSyncCommand,
  persistClinicalPrescriptionBestEffort,
  composeClinicalNote,
  writeupFromEncounterMetadata,
} = vi.hoisted(() => {
  class HospitalAuditRequiredError extends Error {
    constructor(message: string) {
      super(message)
      this.name = 'HospitalAuditRequiredError'
    }
  }
  return {
  requireHospitalStaffContext: vi.fn(),
  requireHospitalCapability: vi.fn(),
  logHospitalAudit: vi.fn(),
  requireHospitalAudit: vi.fn(),
  HospitalAuditRequiredError,
  dbFrom: vi.fn(),
  hashPayload: vi.fn(),
  assertSyncCommand: vi.fn(),
  toSyncOutboxRow: vi.fn(),
  applyWriteupSyncCommand: vi.fn(),
  applyDispositionSyncCommand: vi.fn(),
  applyTriageSyncCommand: vi.fn(),
  triageFromEncounterMetadata: vi.fn(),
  vitalsInsertFromTriage: vi.fn(),
  applyPrescribeSyncCommand: vi.fn(),
  persistClinicalPrescriptionBestEffort: vi.fn(),
  composeClinicalNote: vi.fn(),
  writeupFromEncounterMetadata: vi.fn(),
  }
})

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
    requireHospitalAudit: (...args: unknown[]) => requireHospitalAudit(...args),
    HospitalAuditRequiredError,
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

vi.mock('@synapse/db/clinical-offline-triage', () => ({
  CLINICAL_TRIAGE_COMMAND: 'clinical.encounter.triage.v1',
  applyTriageSyncCommand: (...args: unknown[]) => applyTriageSyncCommand(...args),
  triageFromEncounterMetadata: (...args: unknown[]) => triageFromEncounterMetadata(...args),
  vitalsInsertFromTriage: (...args: unknown[]) => vitalsInsertFromTriage(...args),
}))

vi.mock('@synapse/db/clinical-offline-prescribe', () => ({
  CLINICAL_PRESCRIBE_COMMAND: 'clinical.encounter.prescribe.v1',
  applyPrescribeSyncCommand: (...args: unknown[]) => applyPrescribeSyncCommand(...args),
}))

vi.mock('@synapse/db/prescription-persist', () => ({
  persistClinicalPrescriptionBestEffort: (...args: unknown[]) =>
    persistClinicalPrescriptionBestEffort(...args),
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
    'upsert',
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
    requireHospitalAudit.mockResolvedValue(undefined)

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
    expect(requireHospitalAudit).toHaveBeenCalled()
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

  it.each([
    { actorId: 'another-actor' },
    { aggregateId: 'another-encounter' },
    { commandType: 'clinical.encounter.triage.v1' },
    { facilityId: 'another-facility' },
    { baseRevision: 42 },
  ])('refuses replay under a different stored command identity: %j', async (overrides) => {
    requireHospitalStaffContext.mockResolvedValue({ tenantId: TENANT, userId: USER, hospitalId: FACILITY })
    requireHospitalCapability.mockResolvedValue(null)
    assertSyncCommand.mockImplementation(() => undefined)
    hashPayload.mockResolvedValue('hash-ok')
    dbFrom.mockReturnValue(chain({ data: {
      id: OUTBOX, tenant_id: TENANT, idempotency_key: CMD,
      payload: { envelope: makeCommand(overrides), serverResponse: { private: 'previous result' } },
      status: 'applied', applied_at: null, conflict_reason: null,
    } }))
    const { POST } = await import('./route')
    const res = await POST(makeRequest({ command: makeCommand() }))
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.outcome).toBe('conflict')
    expect(body.result).toBeUndefined()
    expect(applyWriteupSyncCommand).not.toHaveBeenCalled()
    expect(dbFrom).toHaveBeenCalledTimes(1)
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
    requireHospitalAudit.mockResolvedValue(undefined)

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


  it('applies triage using a server-owned vitals id, never the client command id', async () => {
    requireHospitalStaffContext.mockResolvedValue({
      tenantId: TENANT,
      userId: USER,
      hospitalId: FACILITY,
    })
    requireHospitalCapability.mockResolvedValue(null)
    assertSyncCommand.mockImplementation(() => undefined)
    hashPayload.mockResolvedValue('hash-ok')
    toSyncOutboxRow.mockReturnValue({ idempotency_key: CMD })
    applyTriageSyncCommand.mockReturnValue({
      encounterId: ENCOUNTER,
      metadata: { triage: { clinical_stage: 'YELLOW', temperature_c: 38.4 } },
      clinicalStage: 'YELLOW',
      isSigned: false,
      revision: 1,
    })
    triageFromEncounterMetadata.mockReturnValue({ clinical_stage: 'YELLOW', temperature_c: 38.4 })
    vitalsInsertFromTriage.mockReturnValue({ id: OUTBOX, tenant_id: TENANT, encounter_id: ENCOUNTER, temperature_c: 38.4 })
    requireHospitalAudit.mockResolvedValue(undefined)

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
        clinical_stage: null,
        disposition: null,
      },
    })
    const updateEncounterChain = chain({ data: null })
    const vitalsInsertChain = chain({ data: { id: 'vitals-1' } })
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
      if (table === 'vitals') return vitalsInsertChain
      return chain({ data: null })
    })

    const { POST } = await import('./route')
    const res = await POST(
      makeRequest({
        command: makeCommand({
          commandType: 'clinical.encounter.triage.v1',
          payload: {
            encounter_id: ENCOUNTER,
            triage: { clinical_stage: 'YELLOW', temperature_c: 38.4 },
          },
        }),
      }),
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.outcome).toBe('applied')
    expect(json.result.clinicalStage).toBe('YELLOW')
    expect(applyTriageSyncCommand).toHaveBeenCalled()
    expect(vitalsInsertFromTriage).toHaveBeenCalledWith(expect.objectContaining({
      id: OUTBOX, tenantId: TENANT, encounterId: ENCOUNTER, actorId: USER,
    }))
    expect(vitalsInsertChain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ id: OUTBOX, tenant_id: TENANT, encounter_id: ENCOUNTER }),
      { onConflict: 'id' },
    )
    expect(OUTBOX).not.toBe(CMD)
  })


  it('applies prescribe SyncCommand and persists prescription', async () => {
    requireHospitalStaffContext.mockResolvedValue({
      tenantId: TENANT,
      userId: USER,
      hospitalId: FACILITY,
    })
    requireHospitalCapability.mockResolvedValue(null)
    assertSyncCommand.mockImplementation(() => undefined)
    hashPayload.mockResolvedValue('hash-ok')
    toSyncOutboxRow.mockReturnValue({ idempotency_key: CMD })
    const RX = 'ffffffff-ffff-4fff-8fff-ffffffffffff'
    applyPrescribeSyncCommand.mockReturnValue({
      aggregate: { encounterId: ENCOUNTER, isSigned: false, prescriptions: [], revision: 1 },
      prescription: {
        id: RX,
        tenantId: TENANT,
        patientId: '33333333-3333-4333-8333-333333333333',
        encounterId: ENCOUNTER,
        medicationDisplay: 'Amoxicillin 500mg',
        dose: '1 capsule TID',
        quantity: 15,
        unit: 'capsule',
        prescriberId: USER,
        status: 'active',
        isSynthetic: false,
        correlationId: ENCOUNTER,
      },
    })
    persistClinicalPrescriptionBestEffort.mockResolvedValue({ ok: true })
    requireHospitalAudit.mockResolvedValue(undefined)

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
        patient_id: '33333333-3333-4333-8333-333333333333',
        clinical_stage: 'YELLOW',
        disposition: null,
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
          commandType: 'clinical.encounter.prescribe.v1',
          payload: {
            encounter_id: ENCOUNTER,
            patient_id: '33333333-3333-4333-8333-333333333333',
            prescription_id: RX,
            medication_display: 'Amoxicillin 500mg',
            dose: '1 capsule TID',
            quantity: 15,
            unit: 'capsule',
          },
        }),
      }),
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.outcome).toBe('applied')
    expect(json.result.prescriptionId).toBe(RX)
    expect(applyPrescribeSyncCommand).toHaveBeenCalled()
    expect(persistClinicalPrescriptionBestEffort).toHaveBeenCalled()
  })

  it('refuses applied when required audit fails and leaves outbox for idempotent retry', async () => {
    requireHospitalStaffContext.mockResolvedValue({
      tenantId: TENANT,
      userId: USER,
      hospitalId: FACILITY,
      role: 'doctor',
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
    requireHospitalAudit.mockRejectedValue(new HospitalAuditRequiredError('audit insert failed'))

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
    const queuedAgainChain = chain({ data: null })

    let outboxOps = 0
    let encounterOps = 0
    dbFrom.mockImplementation((table: string) => {
      if (table === 'offline_mutation_outbox') {
        outboxOps += 1
        if (outboxOps === 1) return findChain
        if (outboxOps === 2) return insertChain
        if (outboxOps === 3) return syncingChain
        return queuedAgainChain
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
    expect(res.status).toBe(503)
    const json = await res.json()
    expect(json.ok).not.toBe(true)
    expect(json.outcome).toBe('retry')
    expect(json.error).toBe('AUDIT_REQUIRED_FAILED')
    expect(requireHospitalAudit).toHaveBeenCalled()
    expect(queuedAgainChain.update).toHaveBeenCalled()
  })


})
