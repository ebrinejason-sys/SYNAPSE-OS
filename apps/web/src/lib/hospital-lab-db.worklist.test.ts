import { describe, expect, it, vi } from 'vitest'

// Regression (release acceptance round 2, D4): the worklist embedded
// patients(first_name, last_name) but public.patients has no such columns
// (prod + local), so GET /api/lab/worklist returned 500
// "column patients_1.first_name does not exist" for every lab user.

const selects: string[] = []
const mocks = vi.hoisted(() => ({ from: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@synapse/db/admin', () => ({ supabaseAdmin: { from: mocks.from } }))

function chain(data: unknown) {
  const q: Record<string, unknown> = {}
  for (const m of ['eq', 'order', 'limit', 'in']) q[m] = () => q
  q.select = (cols: string) => { selects.push(cols); return q }
  q.then = (resolve: (v: unknown) => unknown) => resolve({ data, error: null })
  return q
}

describe('fetchHospitalLabWorklist', () => {
  it('embeds only real patient columns and maps full_name', async () => {
    mocks.from.mockImplementation((table: string) =>
      table === 'lab_orders'
        ? chain([{ id: 'o1', tenant_id: 't1', encounter_id: 'e1', patient_id: 'p1', loinc_code: '70569-9', test_name: 'Malaria RDT', urgency: 'STAT', status: 'ORDERED', workflow_status: 'ordered', accession_number: null, ordered_at: '2026-09-27T12:00:00Z', patients: { full_name: 'Kato Synthetic', mrn: 'MRN-1' } }])
        : chain([]),
    )
    const { fetchHospitalLabWorklist } = await import('./hospital-lab-db')
    const res = await fetchHospitalLabWorklist({ tenantId: 't1' } as never)
    const embed = selects.find((s) => s.includes('patients('))!
    expect(embed).not.toMatch(/first_name|last_name/)
    expect(embed).toMatch(/patients\(full_name, mrn\)/)
    expect(res.error).toBeUndefined()
    expect(res.orders[0]!.patientName).toBe('Kato Synthetic')
  })
})

describe('patients column references (static guard)', () => {
  it('no select/embed of patients uses first_name, last_name or date_of_birth', async () => {
    const { readFileSync, readdirSync, statSync } = await import('node:fs')
    const { join, relative } = await import('node:path')
    const root = join(__dirname, '..')
    const walk = (d: string): string[] => readdirSync(d).flatMap((n) => {
      const p = join(d, n)
      return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(p) && !/\.test\.tsx?$/.test(p) ? [p] : []
    })
    const bad: string[] = []
    for (const f of walk(join(root, 'app/api')).concat(walk(join(root, 'lib')))) {
      const src = readFileSync(f, 'utf8')
      const hits = [
        ...src.matchAll(/patients\(([^)]*)\)/g),
        ...src.matchAll(/from\(\s*['"]patients['"]\s*\)\s*\.select\(\s*['"`]([^'"`]*)['"`]/g),
      ]
      for (const m of hits) if (/\b(first_name|last_name|date_of_birth)\b/.test(m[1]!)) bad.push(`${relative(root, f)}: ${m[0].slice(0, 80)}`)
    }
    expect(bad).toEqual([])
  })
})
