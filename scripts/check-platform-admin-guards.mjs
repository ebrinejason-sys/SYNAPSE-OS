#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const apiDir = join(root, 'apps/web/src/app/api/platform')
const violations = []

function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(full)
      continue
    }
    if (!entry.name.endsWith('.ts') && !entry.name.endsWith('.tsx')) continue
    const text = readFileSync(full, 'utf8')
    if (text.includes('from "@/lib/platform/require-admin-api"') || text.includes("from '@/lib/platform/require-admin-api'") || text.includes('from "../../../../lib/platform/require-admin-api"') || text.includes("from '../../../../lib/platform/require-admin-api'")) {
      violations.push(full.replace(root + '/', ''))
    }
    if (text.includes('hasPlatformAdminAccess(')) {
      violations.push(full.replace(root + '/', ''))
    }
  }
}

// Mutations must be gated by an explicit platform capability, not by "any
// platform membership" (observers/auditors hold memberships too).
const MUTATION_EXPORT = /export\s+async\s+function\s+(POST|PUT|PATCH|DELETE)\b/g
const CAPABILITY_EXEMPT = new Set([
  // Self-service step-up for the caller's own session.
  'apps/web/src/app/api/platform/mfa/step-up/route.ts',
  // Read-only probes exposed as POST; they write nothing.
  'apps/web/src/app/api/platform/icd11/probe/route.ts',
  'apps/web/src/app/api/platform/intelligence/route.ts',
])
const capabilityViolations = []

function checkMutationCapabilities(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      checkMutationCapabilities(full)
      continue
    }
    if (entry.name !== 'route.ts') continue
    const rel = full.replace(root + '/', '')
    if (CAPABILITY_EXEMPT.has(rel)) continue
    const text = readFileSync(full, 'utf8')
    for (const m of text.matchAll(MUTATION_EXPORT)) {
      const body = text.slice(m.index, m.index + 1500)
      const guard = body.match(/requirePlatform(?:AdminApi|Access)\(\s*(['"][a-z_.]+['"])?\s*\)|requirePlatformAdmin\(\s*\)/)
      if (!guard || !guard[1]) capabilityViolations.push(`${rel} ${m[1]}`)
    }
  }
}

const actionsDir = join(root, 'apps/web/src/app/platform')
const ACTION_EXEMPT = new Set([
  // Token-authenticated invitation acceptance by the invitee.
  'apps/web/src/app/platform/invite/[token]/actions.ts',
])
function checkServerActions(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      checkServerActions(full)
      continue
    }
    if (entry.name !== 'actions.ts') continue
    const rel = full.replace(root + '/', '')
    if (ACTION_EXEMPT.has(rel)) continue
    const text = readFileSync(full, 'utf8')
    if (/requirePlatformAdmin\(\s*\)|requirePlatformAccess\(\s*\)/.test(text)) {
      capabilityViolations.push(`${rel} (server action without capability)`)
    }
  }
}

try {
  walk(apiDir)
  checkMutationCapabilities(apiDir)
  checkServerActions(actionsDir)
} catch (error) {
  console.error('[platform-admin-guard] unable to scan platform API routes')
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}

if (violations.length > 0) {
  console.error('[platform-admin-guard] deprecated platform admin guard detected in:')
  for (const file of [...new Set(violations)]) {
    console.error(`  - ${file}`)
  }
  process.exit(1)
}

if (capabilityViolations.length > 0) {
  console.error('[platform-admin-guard] platform mutation without an explicit capability:')
  for (const v of [...new Set(capabilityViolations)]) console.error(`  - ${v}`)
  process.exit(1)
}

console.log('[platform-admin-guard] canonical capability-aware platform admin guard is used throughout /api/platform')
