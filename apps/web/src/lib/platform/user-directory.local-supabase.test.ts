/**
 * Real PostgREST semantics for the user directory filters (or/ilike/not/in, range + exact count).
 *
 * Opt-in and LOCAL ONLY: runs when SYNAPSE_LOCAL_SUPABASE_IT=1 and LOCAL_SUPABASE_URL points at
 * 127.0.0.1/localhost (e.g. `supabase start`). It refuses any other host, so it can never touch a
 * hosted/production project. Inserts synthetic profiles tagged with a run id and deletes them after.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { searchPlatformUsers } from './user-directory'

const url = process.env.LOCAL_SUPABASE_URL ?? ''
const key = process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY ?? ''
const isLocal = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/.test(url)
const enabled = process.env.SYNAPSE_LOCAL_SUPABASE_IT === '1' && isLocal && Boolean(key)

const RUN = Math.random().toString(16).slice(2, 10)
const idFor = (i: number) => `5e1f0000-${RUN.slice(0, 4)}-4000-8000-${RUN.slice(4, 8)}${String(i).padStart(8, '0')}`
const TARGET = idFor(99999999)

describe.skipIf(!enabled)('user directory against local PostgREST', () => {
  const db = enabled ? createClient(url, key, { auth: { persistSession: false } }) : (null as never)
  const tag = `dirit-${RUN}`

  beforeAll(async () => {
    const rows = Array.from({ length: 230 }, (_, i) => ({
      id: idFor(i),
      email: `${tag}-user${i}@synthetic.synapse.test`,
      full_name: `Synthetic Dir ${tag} ${i}`,
      role: 'doctor',
      verification_status: 'verified',
      email_verified_at: new Date().toISOString(),
      is_deleted: false,
      created_at: new Date(Date.now() + (i + 1) * 1000).toISOString(),
    }))
    rows.push({
      id: TARGET,
      email: `${tag}-platform-admin-a@synthetic.synapse.test`,
      full_name: `Synthetic Platform Admin A ${tag}`,
      role: 'platform_admin',
      verification_status: 'verified',
      email_verified_at: '2000-01-01T00:00:00Z',
      is_deleted: true,
      created_at: '2000-01-01T00:00:00Z',
    })
    rows.push({
      id: idFor(88888888),
      email: `${tag}-invited@synthetic.synapse.test`,
      full_name: `Synthetic Invited ${tag}`,
      role: 'nurse',
      verification_status: 'pending',
      email_verified_at: null as unknown as string,
      is_deleted: null as unknown as boolean,
      created_at: '2000-01-02T00:00:00Z',
    })
    const { error } = await db.from('profiles').insert(rows)
    if (error) throw new Error(`seed failed: ${error.message}`)
  })

  afterAll(async () => {
    if (!enabled) return
    await db.from('profiles').delete().like('email', `${tag}-%`)
  })

  it('finds the archived account outside the first 200 rows (status + search), with exact totals', async () => {
    const archived = await searchPlatformUsers(db, { status: 'archived', q: tag })
    expect(archived.error).toBeNull()
    expect(archived.rows.map(r => r.id)).toEqual([TARGET])

    const bySearch = await searchPlatformUsers(db, { q: `platform-admin-a@synthetic` })
    expect(bySearch.rows.map(r => r.id)).toContain(TARGET)

    const byId = await searchPlatformUsers(db, { q: TARGET })
    expect(byId.rows.map(r => r.id)).toEqual([TARGET])

    const all = await searchPlatformUsers(db, { q: tag, pageSize: 100 })
    expect(all.total).toBe(232)
    expect(all.pageCount).toBe(3)
    const page3 = await searchPlatformUsers(db, { q: tag, pageSize: 100, page: 3 })
    expect(page3.rows.map(r => r.id)).toContain(TARGET)
  })

  it('treats NULL is_deleted as not archived and applies pending/active filters in SQL', async () => {
    const pending = await searchPlatformUsers(db, { status: 'pending', q: tag })
    expect(pending.rows.map(r => r.id)).toEqual([idFor(88888888)])
    const active = await searchPlatformUsers(db, { status: 'active', q: tag, pageSize: 100 })
    expect(active.total).toBe(230)
    expect(active.rows.some(r => r.id === TARGET)).toBe(false)
    const role = await searchPlatformUsers(db, { role: 'platform_admin', q: tag })
    expect(role.rows.map(r => r.id)).toEqual([TARGET])
  })

  it('search input cannot inject extra PostgREST filters', async () => {
    const res = await searchPlatformUsers(db, { q: `${tag}),role.eq.(doctor` })
    expect(res.error).toBeNull()
    expect(res.total).toBe(0)
  })
})
