#!/usr/bin/env node
/**
 * Mirrors the root vercel.json production build for @synapse/web.
 * Run via: npm run verify:web
 */
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))

function run(label, command, args, opts = {}) {
  console.log(`\n[verify:web] ${label}`)
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    cwd: opts.cwd ?? root,
    env: { ...process.env, ...opts.env },
  })
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

run('type-check (monorepo)', 'npm', ['run', 'type-check'])
run('sync public assets', 'node', ['scripts/sync-web-public.mjs'])
run('next build (@synapse/web)', 'npm', ['run', 'build', '--workspace', '@synapse/web'])

console.log('\n[verify:web] OK — matches root vercel.json buildCommand')
