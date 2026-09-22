import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const requirePlatformAdminApi = vi.fn()
const listAllCommercialPlans = vi.fn()
const getCommercialPlanBySlug = vi.fn()
const updateCommercialPlan = vi.fn()
const historySelect = vi.fn()
const auditInsert = vi.fn()

vi.mock('@/lib/platform/auth', () => ({
  requirePlatformAdminApi: (...args: unknown[]) => requirePlatformAdminApi(...args),
}))

vi.mock('@synapse/db/commercial-pricing', async () => {
  const actual = await vi.importActual<typeof import('@synapse/db/commercial-pricing')>(
    '@synapse/db/commercial-pricing',
  )
  return {
    ...actual,
    listAllCommercialPlans: (...args: unknown[]) => listAllCommercialPlans(...args),
    getCommercialPlanBySlug: (...args: unknown[]) => getCommercialPlanBySlug(...args),
    updateCommercialPlan: (...args: unknown[]) => updateCommercialPlan(...args),
  }
})

vi.mock('@synapse/db/admin', () => ({
  supabaseAdmin: {
    from: (table: string) => {
      if (table === 'commercial_price_history') {
        return {
          select: () => ({
            order: () => ({
              limit: async () => historySelect(),
            }),
          }),
        }
      }
      if (table === 'platform_audit_events') {
        return { insert: async (row: unknown) => auditInsert(row) }
      }
      throw new Error(`unexpected ${table}`)
    },
  },
}))

import { GET, PATCH } from './route'

describe('platform commercial pricing API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    historySelect.mockResolvedValue({ data: [] })
    auditInsert.mockResolvedValue({ error: null })
  })

  it('rejects unauthorized GET', async () => {
    requirePlatformAdminApi.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: 'forbidden' }), { status: 403 }),
    })
    const res = await GET()
    expect(res.status).toBe(403)
  })

  it('rejects unauthorized PATCH', async () => {
    requirePlatformAdminApi.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: 'forbidden' }), { status: 403 }),
    })
    const res = await PATCH(
      new NextRequest('https://admin.synapseos.tech/api/platform/commercial/pricing', {
        method: 'PATCH',
        body: JSON.stringify({ slug: 'synapse_pharmacy_annual', priceUgx: 250000 }),
      }),
    )
    expect(res.status).toBe(403)
    expect(updateCommercialPlan).not.toHaveBeenCalled()
  })

  it('updates price when authorized and writes audit', async () => {
    requirePlatformAdminApi.mockResolvedValue({
      ok: true,
      profile: { id: 'admin-1', platformRole: 'PLATFORM_ADMIN' },
    })
    const current = {
      id: 'plan-1',
      slug: 'synapse_pharmacy_annual',
      name: 'SYNAPSE Pharmacy',
      priceUgx: 240000,
      pricingState: 'PUBLIC_FIXED',
      version: 1,
    }
    getCommercialPlanBySlug.mockResolvedValue(current)
    updateCommercialPlan.mockResolvedValue({ ...current, priceUgx: 250000, version: 2 })

    const res = await PATCH(
      new NextRequest('https://admin.synapseos.tech/api/platform/commercial/pricing', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          slug: 'synapse_pharmacy_annual',
          priceUgx: 250000,
          changeReason: 'acceptance probe',
        }),
      }),
    )
    expect(res.status).toBe(200)
    expect(updateCommercialPlan).toHaveBeenCalled()
    expect(auditInsert).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'COMMERCIAL_PRICE_UPDATED' }),
    )
  })
})
