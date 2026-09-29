import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  capabilities: new Set<string>(),
  closeTill: vi.fn(),
}))

vi.mock('@/lib/pharmacy-context', () => ({
  requireCapability: async () => ({
    ok: true,
    tenantId: 'tenant-a',
    session: { userId: 'cashier-1', capabilities: mocks.capabilities },
  }),
}))
vi.mock('@/lib/capabilities', () => ({
  sessionHasCapability: (_s: unknown, cap: string) => mocks.capabilities.has(cap),
}))
vi.mock('@/lib/pos/till-service', () => ({ closeTill: (...a: unknown[]) => mocks.closeTill(...a) }))
vi.mock('@synapse/db/errors', () => ({ httpStatusForPharmacyError: () => 409 }))

async function close(body: Record<string, unknown>) {
  const { POST } = await import('./route')
  const req = new Request('https://pharm.synapseos.tech/api/admin/till/close', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  return POST(req as any)
}

describe('POST /api/admin/till/close', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.capabilities = new Set(['shift.open_close'])
    mocks.closeTill.mockResolvedValue({ ok: true, session: { id: 's1' } })
  })

  it('closes the caller\'s own till', async () => {
    const res = await close({ sessionId: 's1', countedCash: 100 })
    expect(res.status).toBe(200)
    expect(mocks.closeTill).toHaveBeenCalledWith(expect.objectContaining({ cashierId: 'cashier-1', closerId: 'cashier-1' }))
  })

  it('refuses a cashier closing another cashier\'s till', async () => {
    const res = await close({ sessionId: 's2', countedCash: 0, cashierId: 'cashier-2' })
    expect(res.status).toBe(403)
    expect(mocks.closeTill).not.toHaveBeenCalled()
  })

  it('lets a supervisor close another cashier\'s till', async () => {
    mocks.capabilities = new Set(['shift.open_close', 'shift.approve_variance'])
    const res = await close({ sessionId: 's2', countedCash: 50, cashierId: 'cashier-2', varianceReason: 'count' })
    expect(res.status).toBe(200)
    expect(mocks.closeTill).toHaveBeenCalledWith(expect.objectContaining({ cashierId: 'cashier-2', closerId: 'cashier-1' }))
  })
})
