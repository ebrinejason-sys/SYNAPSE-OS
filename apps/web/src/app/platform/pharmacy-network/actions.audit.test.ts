import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({
  counts: { pharmacy_audit_logs: 0, audit_log: 0 } as Record<string, number>,
  deletes: [] as string[],
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('../../../lib/platform/auth', () => ({ requirePlatformAccess: vi.fn(async () => ({ id: 'admin-a' })) }))
vi.mock('../../../lib/vercel-domains', () => ({ provisionVercelProjectDomain: vi.fn(), verifyVercelProjectDomain: vi.fn() }))
vi.mock('../../../lib/resend', () => ({ sendPharmacyCredentialsEmail: vi.fn() }))
vi.mock('@synapse/auth', () => ({ hashPassword: vi.fn() }))
vi.mock('../_lib/platform-data', () => ({ logPlatformEvent: vi.fn() }))
vi.mock('../../../lib/supabase/server', () => ({
  createServiceClient: () => ({
    from: (table: string) => {
      const q: any = {
        select: () => q,
        eq: () => q,
        maybeSingle: async () => ({ data: table === 'tenants' ? { id: 't1', facility_type: 'pharmacy' } : null, error: null }),
        delete: () => (m.deletes.push(table), q),
        then: (res: any) => Promise.resolve({ data: null, error: null, count: m.counts[table] ?? 0 }).then(res),
      }
      return q
    },
  }),
}))

import { deletePharmacy } from './actions'

function form() {
  const fd = new FormData()
  fd.set('tenant_id', 't1')
  return fd
}

describe('deletePharmacy audit preservation', () => {
  beforeEach(() => {
    m.deletes = []
    m.counts = { pharmacy_audit_logs: 0, audit_log: 0 }
  })

  it('refuses to hard-delete a pharmacy that has audit history (tenant FK cascade would erase it)', async () => {
    m.counts.pharmacy_audit_logs = 3
    await expect(deletePharmacy(form())).rejects.toThrow(/audit history/i)
    expect(m.deletes).toEqual([])
  })

  it('refuses when only platform audit_log rows reference the tenant', async () => {
    m.counts.audit_log = 1
    await expect(deletePharmacy(form())).rejects.toThrow(/audit history/i)
    expect(m.deletes).toEqual([])
  })

  it('still allows deleting an empty, never-used pharmacy', async () => {
    await deletePharmacy(form())
    expect(m.deletes).toContain('tenants')
  })
})
