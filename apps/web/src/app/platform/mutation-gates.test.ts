/**
 * Regression guard: every control-plane mutation names the capability it needs.
 *
 * A bare requirePlatformAccess() / requirePlatformAdmin() / requirePlatformAdminApi()
 * admits ANY platform role (including READ_ONLY_OBSERVER and SUPPORT_ADMIN), and the
 * NAV_CAPABILITY_MAP only filters navigation, so it is not an authorization layer.
 * Scans: exported functions of 'use server' modules, inline 'use server' functions in
 * pages, and non-GET handlers of /api/platform routes.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { PLATFORM_CAPABILITIES } from '../../lib/platform/rbac'

const APP = fileURLToPath(new URL('..', import.meta.url))

/** Deliberate exceptions: [file relative to src/app, function name, reason]. */
const ALLOW: Array<[string, string, string]> = [
  ['platform/invite/[token]/actions.ts', 'acceptPlatformInvite', 'authorized by the single-use invitation token'],
  ['api/platform/mfa/step-up/route.ts', 'POST', 'self-service MFA step-up for the caller only'],
]

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p)
  }
  return out
}

type Finding = { file: string; fn: string; gate: string | null }

function gateAfter(src: string, from: string, start: number): string | null {
  // Only look inside this function: stop at the next top-level declaration.
  const rest = src.slice(start)
  const end = rest.search(/\n(?:export\s+)?(?:async\s+)?function\s|\nexport\s+(?:const|default)\s/)
  const body = rest.slice(0, end === -1 ? 1500 : end).slice(0, 1500)
  const m = body.match(/require(?:PlatformAccess|PlatformAdmin|PlatformAdminApi|CanonicalPlatformAdminApi)\s*\(([^)]*)\)/)
  if (m) return m[0]
  // A thin wrapper that only delegates to another action in the same module is judged by that action.
  for (const call of body.matchAll(/(?:return|await)\s+(\w+)\s*\(/g)) {
    const delegate = call[1]!
    if (delegate === from) continue
    const decl = new RegExp(`async function ${delegate}\\s*\\(`).exec(src)
    if (decl) return gateAfter(src, delegate, decl.index + decl[0].length)
  }
  return null
}

function collect(): Finding[] {
  const findings: Finding[] = []
  for (const file of walk(join(APP, 'platform')).concat(walk(join(APP, 'api', 'platform')))) {
    const rel = relative(APP, file).split('\\').join('/')
    const src = readFileSync(file, 'utf8')
    const moduleServer = /^\s*(['"])use server\1/.test(src)
    if (moduleServer) {
      for (const m of src.matchAll(/export async function (\w+)\s*\(/g)) {
        findings.push({ file: rel, fn: m[1]!, gate: gateAfter(src, m[1]!, m.index! + m[0].length) })
      }
    }
    for (const m of src.matchAll(/async function (\w+)\s*\([^)]*\)[^{]*\{\s*(['"])use server\2/g)) {
      findings.push({ file: rel, fn: m[1]!, gate: gateAfter(src, m[1]!, m.index! + m[0].length) })
    }
    if (rel.startsWith('api/platform/') && rel.endsWith('route.ts')) {
      for (const m of src.matchAll(/export async function (POST|PUT|PATCH|DELETE)\s*\(/g)) {
        findings.push({ file: rel, fn: m[1]!, gate: gateAfter(src, m[1]!, m.index! + m[0].length) })
      }
    }
  }
  return findings
}

const allowed = (f: Finding) => ALLOW.some(([file, fn]) => file === f.file && fn === f.fn)

describe('control-plane mutation gates', () => {
  const findings = collect()

  it('finds the known mutation surfaces (scanner sanity)', () => {
    const names = findings.map((f) => `${f.file}#${f.fn}`)
    expect(names).toEqual(expect.arrayContaining([
      'platform/users/actions.ts#suspendUserAccount',
      'platform/_lib/subscription-actions.ts#suspendSubscription',
      'platform/billing/page.tsx#markSubscriptionPaid',
      'platform/flags/page.tsx#saveFeatureFlag',
      'platform/approvals/page.tsx#updateVerificationStatus',
      'api/platform/impersonate/route.ts#POST',
    ]))
    expect(findings.length).toBeGreaterThan(60)
  })

  it('every mutation calls a platform gate with an explicit, known capability', () => {
    const known = new Set<string>(PLATFORM_CAPABILITIES)
    const bad = findings
      .filter((f) => !allowed(f))
      .filter((f) => {
        // Helpers that delegate to another gated action (e.g. deactivate -> suspend) are fine
        // when the gate found is the delegate's; require a capability argument either way.
        const cap = f.gate?.match(/\(\s*['"]([^'"]+)['"]\s*\)/)?.[1]
        return !cap || !known.has(cap)
      })
      .map((f) => `${f.file}#${f.fn}: ${f.gate ?? 'no gate found'}`)
    expect(bad).toEqual([])
  })
})
