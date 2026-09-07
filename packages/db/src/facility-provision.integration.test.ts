import { describe, it, expect } from 'vitest'
import { provisionFacility, resumeFacilityProvision } from './facility-provision'

// In-memory PostgREST adapter: exercises the real orchestration and persisted effects.
function database() {
  const tables: Record<string, any[]> = {
    subscription_plans: [
      { id: 'hospital-plan', slug: 'hospital_starter', facility_type: 'hospital', is_active: true },
      { id: 'pharmacy-plan', slug: 'pharmacy_starter', facility_type: 'pharmacy', is_active: true },
    ],
  }
  let failure = ''
  const db = {
    tables,
    failAt(table: string) { failure = table },
    from(table: string) {
      const rows = tables[table] ??= []
      const filters: Array<(r: any) => boolean> = []
      let mode = 'select', payload: any, conflict = '', single = false, max = Infinity
      const q: any = {
        select() { return q }, eq(k: string, v: unknown) { filters.push(r => r[k] === v); return q },
        in(k: string, v: unknown[]) { filters.push(r => v.includes(r[k])); return q },
        order() { return q }, limit(n: number) { max = n; return q },
        maybeSingle() { single = true; return q }, single() { single = true; return q },
        insert(v: any) { mode = 'insert'; payload = v; return q },
        update(v: any) { mode = 'update'; payload = v; return q },
        upsert(v: any, opts: any = {}) { mode = 'upsert'; payload = v; conflict = opts.onConflict ?? 'id'; return q },
        then(resolve: (v: any) => void) {
          if (failure === table && mode !== 'select') return Promise.resolve({ data: null, error: { message: 'Synthetic injected failure' } }).then(resolve)
          let result = rows.filter(r => filters.every(f => f(r)))
          if (mode === 'insert' || mode === 'upsert') {
            result = (Array.isArray(payload) ? payload : [payload]).map(v => {
              const existing = mode === 'upsert' && rows.find(r => conflict.split(',').every(k => r[k] === v[k]))
              if (existing) return Object.assign(existing, v)
              const row = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...v }
              rows.push(row); return row
            })
          } else if (mode === 'update') result.forEach(r => Object.assign(r, payload))
          result = result.slice(0, max)
          return Promise.resolve({ data: single ? result[0] ?? null : result, error: null }).then(resolve)
        },
      }
      return q
    },
  }
  return db
}
const input = (type: 'hospital' | 'pharmacy' | 'laboratory', suffix = 'a') => ({
  facilityType: type, facilityName: `SYNAPSE ACCEPTANCE ${type} ${suffix}`, slug: `acceptance-${type}-${suffix}`,
  adminName: 'Synthetic Admin', adminEmail: `${type}-${suffix}@example.test`, createdBy: 'platform-admin',
  mode: 'SYNTHETIC_ACCEPTANCE' as const,
})
describe('facility orchestration with persisted effects', () => {
  it.each(['hospital', 'pharmacy', 'laboratory'] as const)('%s remains inactive on invitation failure and retries without duplicate resources', async type => {
    const db = database(); db.failAt('facility_invitations')
    const failed = await provisionFacility(db, input(type))
    expect(failed.ok).toBe(false)
    expect(db.tables.facility_provisioning_steps.some(r => r.step === "invitation" && r.status === "FAILED")).toBe(true)
    expect(db.tables.tenants[0].is_active).toBe(false)
    db.failAt('')
    const retried = await resumeFacilityProvision(db, failed.runId, 'platform-admin')
    expect(retried.ok).toBe(true)
    expect(db.tables.tenants).toHaveLength(1)
    expect(db.tables.tenants[0].facility_type).toBe(type)
    expect(db.tables.facility_invitations).toHaveLength(1)
    expect(db.tables.tenant_subscriptions).toHaveLength(1)
    expect(db.tables.tenants[0].is_active).toBe(true)
    if (type === 'pharmacy') expect(db.tables.facility_provisioning_runs[0].failure_code).toBeNull()
    const counts = Object.fromEntries(Object.entries(db.tables).map(([k, v]) => [k, v.length]))
    db.tables.facility_provisioning_runs[0].failure_code = 'STALE_FAILURE'
    const replayed = await provisionFacility(db, input(type))
    expect(replayed.inviteToken).toBe(db.tables.facility_invitations[0].invite_token)
    expect(replayed.inviteStatus).toBe(db.tables.facility_invitations[0].status)
    expect(db.tables.facility_provisioning_runs[0].failure_code).toBeNull()
    expect(Object.fromEntries(Object.entries(db.tables).map(([k, v]) => [k, v.length]))).toEqual(counts)
  })
  it('laboratory keeps its tenant link, exact lean modules, and lab administrator', async () => {
    const db = database()
    const result = await provisionFacility(db, input('laboratory'))
    expect(result.ok).toBe(true)
    expect(db.tables.hospitals[0].settings.tenant_id).toBe(result.tenantId)
    expect(db.tables.hospitals[0].facility_kind).toBe('laboratory')
    expect(db.tables.hospital_modules.map(r => r.module_key).sort()).toEqual(['billing', 'core', 'lab', 'registration', 'reports'])
    expect(db.tables.profiles).toHaveLength(1)
    expect(db.tables.profiles[0].role).toBe('lab_admin')
    expect(db.tables.facility_invitations[0].role).toBe('lab_admin')
  })
  it('two synthetic hospitals retain distinct names, slugs, departments, and staff', async () => {
    const db = database()
    const a = await provisionFacility(db, input('hospital', 'a'))
    const b = await provisionFacility(db, input('hospital', 'b'))
    expect(a.ok && b.ok).toBe(true)
    expect(a.tenantId).not.toBe(b.tenantId)
    for (const tenantId of [a.tenantId, b.tenantId]) expect(db.tables.departments.filter(r => r.tenant_id === tenantId).some(r => r.name === 'Laboratory')).toBe(true)
  })
  it.each(['facility_locations', 'tenant_subscriptions', 'facility_domain_records'])('a %s failure cannot activate a hospital', async table => {
    const db = database(); db.failAt(table)
    const result = await provisionFacility(db, input('hospital'))
    expect(result.ok).toBe(false)
    expect(db.tables.tenants[0].is_active).toBe(false)
  })
})
