import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'

const mocks = vi.hoisted(() => ({ context: vi.fn(), wrap: vi.fn() }))
vi.mock('@/lib/hospital-dept', () => ({ requireHospitalStaffContext: mocks.context }))
vi.mock('@/lib/hospital-shared', () => ({
  isContextError: (value: unknown) => value instanceof NextResponse,
  hospitalOutboxWrapMaterial: mocks.wrap,
}))
import { GET } from './route'

describe('hospital sync context cache boundary', () => {
  beforeEach(() => { vi.resetAllMocks() })

  it('marks actor recovery material private and non-cacheable', async () => {
    mocks.context.mockResolvedValue({ tenantId: 't', hospitalId: 'h', userId: 'u', role: 'doctor' })
    mocks.wrap.mockReturnValue('synthetic-wrap')
    const response = await GET()
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(response.headers.get('vary')).toBe('Cookie, Authorization')
    expect((await response.json()).syncContext.outboxWrapMaterial).toBe('synthetic-wrap')
    expect(mocks.wrap).toHaveBeenCalledWith('t', 'u')
  })

  it('does not issue recovery material without authenticated context', async () => {
    mocks.context.mockResolvedValue(NextResponse.json({ error: 'unauthorized' }, { status: 401 }))
    expect((await GET()).status).toBe(401)
    expect(mocks.wrap).not.toHaveBeenCalled()
  })
})

