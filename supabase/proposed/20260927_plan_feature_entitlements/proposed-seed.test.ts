import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const dir = __dirname
const up = readFileSync(join(dir, 'up.sql'), 'utf8')
const down = readFileSync(join(dir, 'down.sql'), 'utf8')
const upLower = up.toLowerCase()

const EXPECTED: Record<string, string[]> = {
  synapse_os_basic_annual: ['billing', 'opd', 'registration', 'reports'],
  synapse_os_lab_addon_annual: ['billing', 'lab', 'opd', 'registration', 'reports'],
  synapse_lab_annual: ['billing', 'lab', 'registration', 'reports'],
}

function pairs(sql: string): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const m of sql.matchAll(/\(\s*'([a-z0-9_]+)'\s*,\s*'([a-z0-9_.]+)'\s*\)/g)) {
    ;(out[m[1]!] ??= []).push(m[2]!)
  }
  for (const k of Object.keys(out)) out[k] = [...new Set(out[k])].sort()
  return out
}

function walk(root: string): string[] {
  const files: string[] = []
  for (const name of readdirSync(root)) {
    const p = join(root, name)
    if (statSync(p).isDirectory()) files.push(...walk(p))
    else if (p.endsWith('route.ts')) files.push(p)
  }
  return files
}

describe('proposed plan feature entitlement seed (not auto-applied)', () => {
  it('seeds exactly the approved mapping', () => {
    expect(pairs(up)).toEqual(EXPECTED)
  })

  it('OS + Lab is a superset of OS Basic (single-subscription has_feature)', () => {
    for (const f of EXPECTED.synapse_os_basic_annual!) expect(EXPECTED.synapse_os_lab_addon_annual).toContain(f)
    expect(EXPECTED.synapse_os_basic_annual).not.toContain('lab')
  })

  it('leaves enterprise, custom, legacy hospital_* and pharmacy plans untouched', () => {
    for (const slug of ['synapse_enterprise', 'hospital_starter', 'hospital_professional', 'hospital_enterprise', 'hospital_network', 'synapse_pharmacy_annual', 'synapse_intelligence', 'synapse_exchange']) {
      expect(up).not.toContain(`'${slug}'`)
    }
  })

  it('is idempotent and tenant-safe', () => {
    expect(upLower).toMatch(/on conflict \(plan_id, feature_key\) do nothing/)
    expect(upLower).toMatch(/on conflict \(key\) do nothing/)
    for (const forbidden of [/\bupdate\s/, /\bdelete\s/, /\btruncate\b/, /\bdrop\b/, /\balter\b/, /tenant_subscriptions/, /tenant_feature_overrides/, /\btenants\b/, /\bauth\./]) {
      expect(upLower.replace(/--.*$/gm, '')).not.toMatch(forbidden)
    }
  })

  it('rollback removes exactly the seeded pairs and nothing tenant-owned', () => {
    expect(pairs(down)).toEqual(EXPECTED)
    expect(down.toLowerCase().replace(/--.*$/gm, '')).not.toMatch(/tenant_subscriptions|tenant_feature_overrides|platform_billing_config|\btenants\b/)
  })

  it('registry covers every module key passed to gateHospitalModule', () => {
    const registry = JSON.parse(up.match(/'hospital_module_registry',\s*'(\[[\s\S]*?\])'::jsonb/)![1]!) as Array<{ key: string; feature_key: string | null }>
    const keys = new Set(registry.map((r) => r.key))
    const apiRoot = join(dir, '../../../apps/web/src/app/api')
    const used = new Set<string>()
    for (const file of walk(apiRoot)) {
      for (const m of readFileSync(file, 'utf8').matchAll(/gateHospitalModule\([^)]*?'([a-z_]+)'\)/g)) used.add(m[1]!)
    }
    expect(used.size).toBeGreaterThan(5)
    for (const k of used) expect(keys, `module '${k}' missing from registry`).toContain(k)
    // Approved OS Basic features must correspond to registry feature keys.
    const featureKeys = new Set(registry.map((r) => r.feature_key).filter(Boolean))
    for (const f of new Set(Object.values(EXPECTED).flat())) expect(featureKeys).toContain(f)
  })

  it('is not inside supabase/migrations (cannot be auto-applied)', () => {
    expect(dir.replace(/\\/g, '/')).toContain('supabase/proposed/')
  })
})
