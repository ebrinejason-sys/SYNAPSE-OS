import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(), rowToLabOrder: vi.fn(), loadResults: vi.fn(),
  allocate: vi.fn(), persistSpecimen: vi.fn(), persistOrder: vi.fn(), persistResult: vi.fn(),
}))
vi.mock('@synapse/db/admin', () => ({ supabaseAdmin: { from: mocks.from } }))
vi.mock('@synapse/db/lab-order-persist', () => ({ rowToLabOrder: mocks.rowToLabOrder, persistLabOrderBestEffort: mocks.persistOrder }))
vi.mock('@synapse/db/lab-result-persist', () => ({
  loadLabResultsForOrder: mocks.loadResults, allocateAccessionNumber: mocks.allocate,
  persistLabSpecimenBestEffort: mocks.persistSpecimen, persistLabResultBestEffort: mocks.persistResult,
  persistCriticalAckBestEffort: vi.fn(),
}))

describe('database lab collect retry', () => {
  beforeEach(() => vi.resetAllMocks())
  it.each(['COLLECTED', 'RECEIVED', 'VERIFIED', 'RELEASED', 'AMENDED'])('does not mint specimens or rewrite results at %s', async (status) => {
    const order = { id: 'order', tenantId: 'tenant', status, specimenId: 'specimen', accessionNumber: 'LAB-1', barcode: 'LAB-1' }
    const result = { id: 'result', status: 'final', verifiedBy: 'original-scientist' }
    const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: {}, error: null }) }
    mocks.from.mockReturnValue(query)
    mocks.rowToLabOrder.mockReturnValue(order)
    mocks.loadResults.mockResolvedValue([result])
    const { executeHospitalLabAction } = await import('./hospital-lab-db')
    const response = await executeHospitalLabAction({
      ctx: { tenantId: 'tenant' } as Parameters<typeof executeHospitalLabAction>[0]['ctx'],
      orderId: 'order', action: 'collect', actorId: 'actor', extra: { accessionNumber: 'different' },
    })
    expect(response.order).toEqual(order)
    expect(response.result).toEqual(result)
    expect(query.eq).toHaveBeenCalledWith('tenant_id', 'tenant')
    expect(mocks.allocate).not.toHaveBeenCalled()
    expect(mocks.persistSpecimen).not.toHaveBeenCalled()
    expect(mocks.persistOrder).not.toHaveBeenCalled()
    expect(mocks.persistResult).not.toHaveBeenCalled()
  })
})
