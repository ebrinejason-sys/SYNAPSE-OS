import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LabOrder, LabResult } from '@synapse/db/lab-workflow'

const TENANT_A = '0edb651a-232a-4289-9b3d-ae5bb1bac2cb'
const TENANT_B = '200dfeb5-4c09-4a5d-8d46-14aa4b78a6ec'
const ORDER = 'e76497a1-3a54-4984-827c-f6c339edbf99'
const OTHER_ORDER = 'ffb1e2c7-973b-45a3-b1b9-c8f44da82d72'
const PATIENT = '19bc626f-f51a-4bd5-aefd-7a4534babfeb'
const ENCOUNTER = 'e6edbd38-08be-4f07-aeff-3ad268e939fe'
const SPECIMEN = '206d336c-1a15-413e-ac00-e8af92180ce1'
const USER = '81456280-e996-4ff3-84ba-cada261d5061'
const RESULT = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  rowToLabOrder: vi.fn(),
  loadResults: vi.fn(),
  allocate: vi.fn(),
  persistSpecimen: vi.fn(),
  persistOrder: vi.fn(),
  persistResult: vi.fn(),
  persistAck: vi.fn(),
}))

vi.mock('@synapse/db/admin', () => ({ supabaseAdmin: { from: mocks.from } }))
vi.mock('@synapse/db/lab-order-persist', () => ({
  rowToLabOrder: mocks.rowToLabOrder,
  persistLabOrderBestEffort: mocks.persistOrder,
}))
vi.mock('@synapse/db/lab-result-persist', () => ({
  loadLabResultsForOrder: mocks.loadResults,
  allocateAccessionNumber: mocks.allocate,
  persistLabSpecimenBestEffort: mocks.persistSpecimen,
  persistLabResultBestEffort: mocks.persistResult,
  persistCriticalAckBestEffort: mocks.persistAck,
}))
vi.mock('@synapse/db/clinical-timeline', () => ({
  labResultReleasedTimelineEvent: vi.fn(),
  publishClinicalTimelineBestEffort: vi.fn(),
}))
vi.mock('@synapse/db/identity-persist', () => ({ publishTimelineEvent: vi.fn() }))
vi.mock('@synapse/db/lab-report', () => ({ buildLabReportArtifact: vi.fn() }))
vi.mock('@synapse/db/exchange', () => ({ ExchangeOutbox: class { append() { return {} } } }))
vi.mock('@synapse/db/work-queue-persist', () => ({
  persistDomainEventsBestEffort: vi.fn().mockResolvedValue({ ok: true }),
  persistWorkQueueArtifactsBestEffort: vi.fn().mockResolvedValue({ errors: [] }),
  rowToDepartmentTask: vi.fn(),
}))
vi.mock('@synapse/db/work-queue', () => ({ WorkQueue: class {} }))

function order(status: LabOrder['status'], id = ORDER): LabOrder {
  return {
    id,
    tenantId: TENANT_A,
    patientId: PATIENT,
    personId: '5792e382-d96f-4deb-bc3a-0335f7451638',
    encounterId: ENCOUNTER,
    loincCode: '58410-2',
    testName: 'FBC',
    urgency: 'ROUTINE',
    status,
    orderedBy: USER,
    orderedAt: '2026-09-20T10:31:09.748Z',
    accessionNumber: 'E2E-e76497a1',
    barcode: 'E2Ee76497a1',
    specimenId: SPECIMEN,
    isSynthetic: true,
    correlationId: ENCOUNTER,
  }
}

function result(overrides: Partial<LabResult> = {}): LabResult {
  return {
    id: RESULT,
    labOrderId: ORDER,
    tenantId: TENANT_A,
    patientId: PATIENT,
    loincCode: '58410-2',
    testName: 'FBC',
    resultValue: '4.2',
    numericValue: 4.2,
    unit: '',
    referenceRange: '',
    flag: 'N',
    isCritical: false,
    isAbnormal: false,
    status: 'preliminary',
    version: 1,
    provenance: 'SYSTEM_GENERATED',
    isSynthetic: true,
    ...overrides,
  }
}

describe('hospital lab result order linkage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: {}, error: null }),
    }
    mocks.from.mockReturnValue(query)
    mocks.persistOrder.mockResolvedValue({ ok: true })
    mocks.persistResult.mockResolvedValue({ ok: true })
  })

  it('enter_result persist failure is fail-closed', async () => {
    mocks.rowToLabOrder.mockReturnValue(order('RECEIVED'))
    mocks.loadResults.mockResolvedValue([])
    mocks.persistResult.mockResolvedValue({ ok: false, error: 'column lab_order_id does not exist' })
    const { executeHospitalLabAction } = await import('./hospital-lab-db')
    await expect(
      executeHospitalLabAction({
        ctx: { tenantId: TENANT_A, hospitalId: 'h', userId: USER } as Parameters<typeof executeHospitalLabAction>[0]['ctx'],
        orderId: ORDER,
        action: 'enter_result',
        actorId: USER,
        extra: { value: '4.2' },
      }),
    ).rejects.toThrow(/LAB_RESULT_PERSIST_FAILED/)
  })

  it('enter_result then verify resolves the originating order result', async () => {
    const entered = result()
    mocks.rowToLabOrder.mockReturnValue(order('RECEIVED'))
    mocks.loadResults
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([entered])
    const { executeHospitalLabAction } = await import('./hospital-lab-db')
    const ctx = { tenantId: TENANT_A, hospitalId: 'h', userId: USER } as Parameters<typeof executeHospitalLabAction>[0]['ctx']
    const enteredOutcome = await executeHospitalLabAction({
      ctx,
      orderId: ORDER,
      action: 'enter_result',
      actorId: USER,
      extra: { value: '4.2' },
    })
    expect(enteredOutcome.result?.labOrderId).toBe(ORDER)
    expect(enteredOutcome.result?.tenantId).toBe(TENANT_A)
    expect(enteredOutcome.result?.patientId).toBe(PATIENT)
    expect(mocks.persistResult).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ labOrderId: ORDER, tenantId: TENANT_A, patientId: PATIENT }),
      expect.objectContaining({ encounterId: ENCOUNTER, enteredBy: USER }),
    )

    mocks.rowToLabOrder.mockReturnValue(order('VERIFICATION_PENDING'))
    mocks.loadResults
      .mockResolvedValueOnce([entered])
      .mockResolvedValueOnce([
        result({
          status: 'final',
          verifiedBy: USER,
          verifiedAt: '2026-09-20T10:40:00.000Z',
          provenance: 'LAB_VERIFIED',
        }),
      ])
    const verified = await executeHospitalLabAction({
      ctx,
      orderId: ORDER,
      action: 'verify',
      actorId: USER,
    })
    expect(verified.result?.id).toBe(RESULT)
    expect(verified.result?.labOrderId).toBe(ORDER)
    expect(verified.result?.patientId).toBe(PATIENT)
    expect(verified.result?.tenantId).toBe(TENANT_A)
    expect(verified.result?.status).toBe('final')
    expect(verified.order.status).toBe('VERIFIED')
  })

  it('verify rejects a result bound to a different order', async () => {
    mocks.rowToLabOrder.mockReturnValue(order('VERIFICATION_PENDING'))
    mocks.loadResults.mockResolvedValue([result({ labOrderId: OTHER_ORDER })])
    const { executeHospitalLabAction } = await import('./hospital-lab-db')
    await expect(
      executeHospitalLabAction({
        ctx: { tenantId: TENANT_A, hospitalId: 'h', userId: USER } as Parameters<typeof executeHospitalLabAction>[0]['ctx'],
        orderId: ORDER,
        action: 'verify',
        actorId: USER,
      }),
    ).rejects.toThrow(/LAB_RESULT_NOT_FOUND/)
  })

  it('does not load another tenant order for verify', async () => {
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    mocks.from.mockReturnValue(query)
    mocks.rowToLabOrder.mockReturnValue(null)
    const { executeHospitalLabAction } = await import('./hospital-lab-db')
    await expect(
      executeHospitalLabAction({
        ctx: { tenantId: TENANT_B, hospitalId: 'h', userId: USER } as Parameters<typeof executeHospitalLabAction>[0]['ctx'],
        orderId: ORDER,
        action: 'verify',
        actorId: USER,
      }),
    ).rejects.toThrow(/LAB_ORDER_NOT_FOUND/)
    expect(query.eq).toHaveBeenCalledWith('id', ORDER)
    expect(query.eq).toHaveBeenCalledWith('tenant_id', TENANT_B)
    expect(mocks.loadResults).not.toHaveBeenCalled()
  })
})
