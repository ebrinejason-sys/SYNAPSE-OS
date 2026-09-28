import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const dir = __dirname
const up = readFileSync(join(dir, 'up.sql'), 'utf8').toLowerCase().replace(/--.*$/gm, '')
const down = readFileSync(join(dir, 'down.sql'), 'utf8').toLowerCase().replace(/--.*$/gm, '')
const repo = join(dir, '../../..')
const api = join(repo, 'apps/web/src/app/api/opd')

const CLINICIAN_CAPS: Array<[string, string, string]> = [
  ['encounters/[id]/sign/route.ts', 'encounter', 'sign'],
  ['encounters/[id]/disposition/route.ts', 'encounter', 'disposition'],
  ['encounters/[id]/close/route.ts', 'encounter', 'close'],
  ['results/[resultId]/review/route.ts', 'result', 'review'],
  ['prescriptions/[id]/cancel/route.ts', 'prescription', 'cancel'],
]

function grants() {
  return [...up.matchAll(/\('([a-z_]+)', 'hospital', 'opd', '([a-z]+)', '([a-z]+)'\)/g)].map(
    (m) => `${m[1]}:${m[2]}.${m[3]}`,
  )
}

describe('proposed OPD clinician and nursing capability seed', () => {
  it('matches the capability triples the routes actually require', () => {
    for (const [file, resource, action] of CLINICIAN_CAPS) {
      const src = readFileSync(join(api, file), 'utf8')
      expect(src).toContain(`requireHospitalCapability(ctx, '${resource}', '${action}', 'opd')`)
      expect(up).toMatch(new RegExp(`\\('opd', '${resource}',\\s+'${action}'`))
    }
    const vitals = readFileSync(join(api, 'vitals/route.ts'), 'utf8')
    const queue = readFileSync(join(api, 'queue/route.ts'), 'utf8')
    expect(vitals).toContain("requireHospitalCapability(ctx, 'triage', 'assign', 'opd')")
    expect(queue).toContain("requireHospitalCapability(ctx, 'queue', 'read', 'opd')")
  })

  it('grants clinician actions to doctor and clinical_officer, triage to nurse, nothing to reception or cashier', () => {
    const clinician = CLINICIAN_CAPS.map(([, r, a]) => `${r}.${a}`)
    const expected = [
      ...clinician.map((c) => `doctor:${c}`),
      ...clinician.map((c) => `clinical_officer:${c}`),
      'nurse:triage.assign',
      'nurse:queue.read',
    ]
    expect(grants().sort()).toEqual(expected.sort())
    for (const role of ['receptionist', 'cashier', 'billing_officer']) expect(up).not.toContain(`'${role}'`)
  })

  it('does not grant nurse any sign, disposition, close or prescribing capability', () => {
    expect(grants().filter((g) => g.startsWith('nurse:')).sort()).toEqual(['nurse:queue.read', 'nurse:triage.assign'])
  })

  it('is idempotent, catalogue-only and has a scoped rollback', () => {
    expect(up.match(/on conflict/g)?.length).toBe(2)
    for (const bad of [/\bupdate\s/, /\bdelete\s/, /\bdrop\b/, /\balter\b/, /\btenants\b/, /\bprofiles\b/]) expect(up).not.toMatch(bad)
    expect(down).toMatch(/rc\.role in \('doctor', 'clinical_officer'\)/)
    expect(down).toMatch(/rc\.role = 'nurse'/)
    expect(down).not.toMatch(/delete from public\.capabilities/)
    expect(dir.replace(/\\/g, '/')).toContain('supabase/proposed/')
  })
})
