import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  updates: [] as Array<{ table: string; values: unknown }>,
  deletes: [] as string[],
  logPlatformEvent: vi.fn(),
  targetProfile: null as Record<string, unknown> | null,
}))

vi.mock('@/lib/platform/auth', () => ({
  requirePlatformAdmin: vi.fn(async () => ({ id: 'admin-a', email: 'a@example.test', role: 'platform_admin' })),
}))
vi.mock('@/lib/auth/password-reset.server', () => ({ sendUserPasswordReset: vi.fn() }))
vi.mock('../_lib/platform-data', () => ({ logPlatformEvent: (...a: unknown[]) => mocks.logPlatformEvent(...a) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@synapse/db/admin', () => ({ supabaseAdmin: { from: (t: string) => mocks.from(t) } }))

function chain(table: string) {
  const q: any = {
    then: (resolve: any) => Promise.resolve({ data: null, error: null, count: 2 }).then(resolve),
  }
  for (const m of ['select', 'eq', 'in', 'is']) q[m] = vi.fn(() => q)
  q.maybeSingle = vi.fn(async () => ({ data: mocks.targetProfile, error: null }))
  q.update = vi.fn((values: unknown) => {
    mocks.updates.push({ table, values })
    return q
  })
  q.delete = vi.fn(() => {
    mocks.deletes.push(table)
    return q
  })
  return q
}

import {
  archiveUserAccount,
  deactivateUserAccount,
  permanentlyDeleteIdentity,
  removeFacilityMembership,
  suspendUserAccount,
} from './actions'

function form(values: Record<string, string>) {
  const fd = new FormData()
  for (const [k, v] of Object.entries(values)) fd.set(k, v)
  return fd
}

describe('platform user lifecycle server actions: self-protection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.updates = []
    mocks.deletes = []
    mocks.from.mockImplementation((t: string) => chain(t))
    mocks.targetProfile = { id: 'admin-a', email: 'a@example.test', role: 'platform_admin', verification_status: 'verified', is_deleted: false, tenant_id: null }
  })

  const selfCases: Array<[string, () => Promise<{ ok: boolean; error?: string }>, string]> = [
    ['archiveUserAccount', () => archiveUserAccount(form({ user_id: 'admin-a', reason: 'probe' })), 'archive'],
    ['suspendUserAccount', () => suspendUserAccount(form({ user_id: 'admin-a', reason: 'probe' })), 'suspend'],
    ['deactivateUserAccount', () => deactivateUserAccount(form({ user_id: 'admin-a', reason: 'probe' })), 'suspend'],
    ['permanentlyDeleteIdentity', () => permanentlyDeleteIdentity(form({ user_id: 'admin-a', typed_email: 'a@example.test' })), 'purge'],
    ['removeFacilityMembership', () => removeFacilityMembership(form({ user_id: 'admin-a', tenant_id: 't1' })), 'remove_membership'],
  ]

  it.each(selfCases)('%s invoked directly against the caller is refused with no writes and is audited', async (_name, invoke, attempted) => {
    const result = await invoke()
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/your own account/)
    expect(mocks.updates).toEqual([])
    expect(mocks.deletes).toEqual([])
    expect(mocks.logPlatformEvent).toHaveBeenCalledTimes(1)
    expect(mocks.logPlatformEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'admin-a',
        action: 'user.self_lifecycle_blocked',
        entityId: 'admin-a',
        metadata: { attempted_action: attempted },
      }),
    )
  })

  it('archiving a different platform admin still works when another admin remains', async () => {
    mocks.targetProfile = { id: 'admin-b', email: 'b@example.test', role: 'platform_admin', verification_status: 'verified', is_deleted: false, tenant_id: null }
    const result = await archiveUserAccount(form({ user_id: 'admin-b', reason: 'offboarding' }))
    expect(result.ok).toBe(true)
    expect(mocks.updates).toContainEqual({ table: 'profiles', values: expect.objectContaining({ is_deleted: true }) })
    expect(mocks.logPlatformEvent).toHaveBeenCalledWith(expect.objectContaining({ action: 'user.archived', entityId: 'admin-b' }))
  })
})
