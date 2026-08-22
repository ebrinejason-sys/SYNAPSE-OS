#!/usr/bin/env node
/**
 * Deterministic SYNAPSE Pharm release gate.
 *
 * Required steps always run and fail the process on non-zero.
 * Optional live-backend steps print SKIPPED with a reason — they never print PASS.
 * The summary line is one of:
 *   RELEASE_GATE=FAIL
 *   RELEASE_GATE=PASS
 *   RELEASE_GATE=PASS_WITH_SKIPS
 */
import { spawnSync } from 'node:child_process'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const results = []

function run(name, command, args, { required = true, env = {}, cwd = root } = {}) {
  console.log(`\n[verify:pharm-release] ${name}`)
  const started = Date.now()
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    cwd,
    env: { ...process.env, ...env },
  })
  const status = result.status ?? 1
  const ms = Date.now() - started
  const outcome = status === 0 ? 'PASS' : 'FAIL'
  results.push({ name, required, outcome, status, ms })
  console.log(`[verify:pharm-release] ${name} ${outcome} (${ms}ms)`)
  if (required && status !== 0) {
    printSummary('FAIL')
    process.exit(status)
  }
  return status === 0
}

function skip(name, reason) {
  console.log(`\n[verify:pharm-release] ${name}`)
  console.log(`[verify:pharm-release] SKIPPED — ${reason}`)
  results.push({ name, required: false, outcome: 'SKIPPED', status: null, reason, ms: 0 })
}

function printSummary(final) {
  console.log('\n[verify:pharm-release] summary')
  for (const row of results) {
    const extra = row.reason ? ` (${row.reason})` : ''
    console.log(`  ${row.outcome.padEnd(8)} ${row.name}${extra}`)
  }
  console.log(`\nRELEASE_GATE=${final}`)
}

run('db:check (migration integrity)', 'npm', ['run', 'db:check'])
run('lint @synapse/web', 'npm', ['run', 'lint', '--workspace', '@synapse/web'])
run('lint @synapse/pharmacy', 'npm', ['run', 'lint', '--workspace', '@synapse/pharmacy'])
run('type-check @synapse/web', 'npm', ['run', 'type-check', '--workspace', '@synapse/web'])
run('type-check @synapse/pharmacy', 'npm', ['run', 'type-check', '--workspace', '@synapse/pharmacy'])
run('type-check @synapse/app', 'npm', ['run', 'type-check', '--workspace', '@synapse/app'])
run('test @synapse/pharmacy (unit/domain/authz/contracts)', 'npm', ['run', 'test', '--workspace', '@synapse/pharmacy'])
run('build @synapse/pharmacy', 'npm', ['run', 'build', '--workspace', '@synapse/pharmacy'])
run('verify:web (type-check + Next build)', 'npm', ['run', 'verify:web'])
run('expo export --platform android', 'npm', ['run', 'export:android', '--workspace', '@synapse/app'])

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? ''
const liveUrl = /supabase\.co/.test(supabaseUrl) && !/placeholder/i.test(supabaseUrl)
if (liveUrl && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  skip(
    'live RLS/RPC probes',
    'no disposable integration harness is wired; do not treat unit tests as live tenant isolation proof',
  )
} else {
  skip('live RLS/RPC probes', 'live Supabase credentials are not available in this environment')
}

if (process.env.EXPO_TOKEN) {
  skip(
    'eas android apk',
    'EAS APK is an operator job; this gate proves Metro android export only',
  )
} else {
  skip('eas android apk', 'EXPO_TOKEN unset — cannot authenticate EAS')
}

const skipped = results.some((row) => row.outcome === 'SKIPPED')
printSummary(skipped ? 'PASS_WITH_SKIPS' : 'PASS')
process.exit(0)
