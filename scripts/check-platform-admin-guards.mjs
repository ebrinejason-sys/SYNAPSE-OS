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

try {
  walk(apiDir)
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

console.log('[platform-admin-guard] canonical capability-aware platform admin guard is used throughout /api/platform')
