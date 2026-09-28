import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const dir = __dirname
const up = readFileSync(join(dir, 'up.sql'), 'utf8').toLowerCase().replace(/--.*$/gm, '')
const down = readFileSync(join(dir, 'down.sql'), 'utf8').toLowerCase().replace(/--.*$/gm, '')
const repo = join(dir, '../../..')

describe('proposed OPD sign/disposition capability seed', () => {
  it('matches the capability triples the routes actually require', () => {
    const sign = readFileSync(join(repo, 'apps/web/src/app/api/opd/encounters/[id]/sign/route.ts'), 'utf8')
    const disp = readFileSync(join(repo, 'apps/web/src/app/api/opd/encounters/[id]/disposition/route.ts'), 'utf8')
    expect(sign).toMatch(/requireHospitalCapability\(ctx, 'encounter', 'sign', 'opd'\)/)
    expect(disp).toMatch(/requireHospitalCapability\(ctx, 'encounter', 'disposition', 'opd'\)/)
    expect(up).toContain("('opd', 'encounter', 'sign'")
    expect(up).toContain("('opd', 'encounter', 'disposition'")
  })

  it('grants doctor and clinical_officer, not reception or nursing', () => {
    const grants = [...up.matchAll(/\('([a-z_]+)', 'hospital', 'opd', 'encounter', '([a-z]+)'\)/g)].map((m) => `${m[1]}:${m[2]}`)
    expect(grants.sort()).toEqual([
      'clinical_officer:disposition',
      'clinical_officer:sign',
      'doctor:disposition',
      'doctor:sign',
    ])
    for (const role of ['receptionist', 'nurse', 'cashier']) expect(up).not.toContain(`'${role}'`)
  })

  it('is idempotent, catalogue-only and has a scoped rollback', () => {
    expect(up.match(/on conflict/g)?.length).toBe(2)
    for (const bad of [/\bupdate\s/, /\bdelete\s/, /\bdrop\b/, /\balter\b/, /\btenants\b/, /\bprofiles\b/]) expect(up).not.toMatch(bad)
    expect(down).toMatch(/rc\.role in \('doctor', 'clinical_officer'\)/)
    expect(down).not.toMatch(/delete from public\.capabilities/)
    expect(dir.replace(/\\/g, '/')).toContain('supabase/proposed/')
  })
})
