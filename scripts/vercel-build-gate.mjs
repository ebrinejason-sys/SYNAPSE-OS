#!/usr/bin/env node
/**
 * Vercel ignoreCommand gate — exit 1 = build, exit 0 = skip (cancel deploy).
 * @see https://vercel.com/docs/project-configuration/vercel-json#ignorecommand
 *
 * Usage in vercel.json:
 *   "ignoreCommand": "node scripts/vercel-build-gate.mjs web"
 *   "ignoreCommand": "node ../../scripts/vercel-build-gate.mjs pharmacy"
 */
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const target = process.argv[2] ?? 'web'

function run(label, command, args, opts = {}) {
  console.log(`[vercel-build-gate] ${label}`)
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    cwd: opts.cwd ?? root,
    env: { ...process.env, ...opts.env },
  })
  return result.status ?? 1
}

let ok = false

if (target === 'web') {
  ok = run('web type-check', 'npm', ['run', 'type-check', '--workspace', '@synapse/web']) === 0
} else if (target === 'pharmacy') {
  ok =
    run('pharmacy build', 'npm', ['run', 'build', '--workspace', '@synapse/pharmacy'], {
      env: { NODE_OPTIONS: '--max-old-space-size=4096' },
    }) === 0
} else {
  console.error(`Unknown target: ${target}`)
  process.exit(0)
}

if (ok) {
  console.log('[vercel-build-gate] Passed — proceeding with Vercel build.')
  process.exit(1)
}

console.error('[vercel-build-gate] Failed — skipping Vercel build (deploy canceled).')
process.exit(0)
