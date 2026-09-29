import { describe, expect, it } from 'vitest'
import { createMemoryDb } from '../../test-utils/memory-postgrest'
import {
  directoryHref,
  normalizeDirectoryParams,
  sanitizeSearchTerm,
  searchPlatformUsers,
  MAX_PAGE_SIZE,
} from './user-directory'

const DAY = 86_400_000
const BASE = Date.parse('2026-01-01T00:00:00Z')

/** 260 synthetic profiles, newest first by created_at; index 0 is the oldest. */
function directoryDb(extra: Array<Record<string, unknown>> = []) {
  const profiles = Array.from({ length: 260 }, (_, i) => ({
    id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
    email: `user${i}@synthetic.synapse.test`,
    full_name: `Synthetic User ${i}`,
    role: i % 3 === 0 ? 'doctor' : i % 3 === 1 ? 'nurse' : 'pharmacist',
    verification_status: 'verified',
    email_verified_at: new Date(BASE + i * DAY).toISOString(),
    synapse_id: `SYN-${1000 + i}`,
    is_deleted: false,
    created_at: new Date(BASE + i * DAY).toISOString(),
  }))
  return createMemoryDb({ profiles: [...profiles, ...extra] })
}

const OLD_ARCHIVED_ADMIN = {
  id: '00000000-0000-4000-8000-0000000aaaaa',
  email: 'synthetic-platform-admin-a@synapse.test',
  full_name: 'Synthetic Platform Admin A',
  role: 'platform_admin',
  verification_status: 'verified',
  email_verified_at: '2025-06-01T00:00:00Z',
  synapse_id: 'SYN-ADMIN-A',
  is_deleted: true,
  // Oldest profile: under the old "first 200 by created_at desc" list it was never loaded.
  created_at: '2025-06-01T00:00:00Z',
}

describe('searchPlatformUsers (server-side filtering + pagination)', () => {
  it('pages with an exact total instead of truncating at a fixed first set', async () => {
    const db = directoryDb()
    const first = await searchPlatformUsers(db, {})
    expect(first.total).toBe(260)
    expect(first.rows).toHaveLength(50)
    expect(first.pageCount).toBe(6)
    expect(first.rows[0].email).toBe('user259@synthetic.synapse.test')
    const last = await searchPlatformUsers(db, { page: 6 })
    expect(last.rows).toHaveLength(10)
    expect(last.rows.at(-1)?.email).toBe('user0@synthetic.synapse.test')
  })

  it('finds an archived account that sits outside the first 200 rows, by status, email, name, Synapse ID and id', async () => {
    const db = directoryDb([OLD_ARCHIVED_ADMIN])
    // Prove the premise: the old query (created_at desc, limit 200) never included it.
    const oldWindow = [...db.tables.profiles].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)).slice(0, 200)
    expect(oldWindow.some(r => r.id === OLD_ARCHIVED_ADMIN.id)).toBe(false)

    for (const params of [
      { status: 'archived' },
      { q: 'platform-admin-a', status: 'archived' },
      { q: 'SYNTHETIC PLATFORM ADMIN' },
      { q: 'syn-admin-a' },
      { q: OLD_ARCHIVED_ADMIN.id },
      { role: 'platform_admin' },
    ]) {
      const res = await searchPlatformUsers(db, params)
      expect(res.error, JSON.stringify(params)).toBeNull()
      expect(res.rows.map(r => r.id), JSON.stringify(params)).toEqual([OLD_ARCHIVED_ADMIN.id])
      expect(res.total).toBe(1)
    }
  })

  it('status filters: active, suspended, archived, pending are mutually consistent', async () => {
    const db = directoryDb([
      OLD_ARCHIVED_ADMIN,
      { ...OLD_ARCHIVED_ADMIN, id: 'suspended-1', email: 's@synthetic.synapse.test', is_deleted: false, verification_status: 'suspended' },
      { ...OLD_ARCHIVED_ADMIN, id: 'pending-1', email: 'p@synthetic.synapse.test', is_deleted: false, email_verified_at: null, verification_status: null },
      { ...OLD_ARCHIVED_ADMIN, id: 'legacy-deleted', email: 'd@synthetic.synapse.test', is_deleted: false, verification_status: 'deleted' },
      { ...OLD_ARCHIVED_ADMIN, id: 'null-status', email: 'n@synthetic.synapse.test', is_deleted: false, verification_status: null },
    ])
    const archived = await searchPlatformUsers(db, { status: 'archived', pageSize: 100 })
    expect(archived.rows.map(r => r.id).sort()).toEqual([OLD_ARCHIVED_ADMIN.id, 'legacy-deleted'].sort())
    const suspended = await searchPlatformUsers(db, { status: 'suspended', pageSize: 100 })
    expect(suspended.rows.map(r => r.id)).toEqual(['suspended-1'])
    const pending = await searchPlatformUsers(db, { status: 'pending', pageSize: 100 })
    expect(pending.rows.map(r => r.id)).toEqual(['pending-1'])
    const active = await searchPlatformUsers(db, { status: 'active', pageSize: 100 })
    expect(active.total).toBe(261) // 260 verified + null-status
    expect(active.rows.some(r => ['suspended-1', 'pending-1', 'legacy-deleted', OLD_ARCHIVED_ADMIN.id].includes(String(r.id)))).toBe(false)
  })

  it('role filter and search combine (AND) with pagination', async () => {
    const db = directoryDb()
    const res = await searchPlatformUsers(db, { role: 'doctor', q: 'user2', pageSize: 5 })
    expect(res.rows.every(r => r.role === 'doctor' && String(r.email).includes('user2'))).toBe(true)
    expect(res.rows.length).toBeLessThanOrEqual(5)
    expect(res.total).toBeGreaterThan(5)
  })
})

describe('input normalisation', () => {
  it('strips PostgREST filter syntax so input is only ever a literal substring', () => {
    expect(sanitizeSearchTerm('a,b(c)*d%e\\f:g"h')).toBe('a b c d e f g h')
    expect(sanitizeSearchTerm('x'.repeat(500))).toHaveLength(100)
    expect(sanitizeSearchTerm('email.eq.x),role.eq.(platform_admin')).toBe('email.eq.x role.eq. platform_admin')
  })

  it('clamps paging and rejects unknown status/role values', () => {
    expect(normalizeDirectoryParams({ page: '-3', pageSize: '100000', status: 'DROP', role: 'x;y' })).toEqual({
      q: '', role: '', status: '', page: 1, pageSize: MAX_PAGE_SIZE,
    })
    expect(normalizeDirectoryParams({ status: 'Archived', role: 'Platform_Admin' })).toMatchObject({ status: 'archived', role: 'platform_admin' })
  })

  it('pagination links keep the active filters', () => {
    const p = normalizeDirectoryParams({ q: 'admin', status: 'archived', role: 'platform_admin' })
    expect(directoryHref(p, { page: 3 })).toBe('/platform/users?q=admin&role=platform_admin&status=archived&page=3')
    expect(directoryHref(normalizeDirectoryParams({}))).toBe('/platform/users')
  })
})
