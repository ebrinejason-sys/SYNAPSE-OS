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

describe('database lab specimen rejection', () => {
  beforeEach(() => vi.resetAllMocks())
  it('marks the specimen rejected using existing lab_specimens columns', async () => {
    const order = {
      id: 'order', tenantId: 'tenant', patientId: 'patient', status: 'COLLECTED',
      specimenId: 'specimen', accessionNumber: 'LAB-1', barcode: 'LAB-1',
    }
    const updates: Array<{ table: string; payload: Record<string, unknown> }> = []
    const query = (table: string) => {
      const q: Record<string, unknown> = {}
      for (const m of ['select', 'eq', 'in', 'order', 'limit', 'insert', 'upsert']) q[m] = vi.fn(() => q)
      q.update = vi.fn((payload: Record<string, unknown>) => { updates.push({ table, payload }); return q })
      q.maybeSingle = vi.fn().mockResolvedValue({ data: {}, error: null })
      q.then = (resolve: (v: unknown) => unknown) => resolve({ data: null, error: null })
      return q
    }
    mocks.from.mockImplementation(query)
    mocks.rowToLabOrder.mockReturnValue(order)
    mocks.loadResults.mockResolvedValue([])
    mocks.persistOrder.mockResolvedValue({ ok: true })
    const { executeHospitalLabAction } = await import('./hospital-lab-db')
    const response = await executeHospitalLabAction({
      ctx: { tenantId: 'tenant' } as Parameters<typeof executeHospitalLabAction>[0]['ctx'],
      orderId: 'order', action: 'reject', actorId: 'actor', extra: { reason: 'hemolyzed', note: 'Haemolysed' },
    })
    const specimenUpdate = updates.find((u) => u.table === 'lab_specimens')
    expect(specimenUpdate?.payload).toMatchObject({ status: 'rejected', condition: 'hemolyzed' })
    expect(Object.keys(specimenUpdate?.payload ?? {})).not.toContain('rejection_reason')
    expect(response.order.status).toBe('REJECTED')
    expect(response.warnings).toEqual([])
  })
})
