#!/usr/bin/env node
/**
 * Push Flutterwave + billing env vars from repo root .env to Vercel projects.
 *
 * Prerequisites: fill keys in .env at repo root, then:
 *   node scripts/sync-flutterwave-vercel.mjs
 *   node scripts/sync-flutterwave-vercel.mjs --dry-run
 */

import { readFileSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const DRY = process.argv.includes('--dry-run')
const SCOPE = 'ebrines-projects-d0493afe'

const PROJECTS = {
  web: {
    cwd: ROOT,
    label: 'synpase-os (synapseos.tech)',
    vars: [
      'FLUTTERWAVE_SECRET_KEY',
      'FLUTTERWAVE_PUBLIC_KEY',
      'FLUTTERWAVE_WEBHOOK_SECRET',
      'FLUTTERWAVE_ENCRYPTION_KEY',
      'CRON_SECRET',
      'NEXT_PUBLIC_APP_URL',
      'NEXT_PUBLIC_PHARMACY_APP_URL',
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
      'RESEND_API_KEY',
    ],
  },
  pharmacy: {
    cwd: resolve(ROOT, 'apps/pharmacy'),
    label: 'synapse-pharm (pharm.synapseos.tech)',
    vars: [
      'FLUTTERWAVE_SECRET_KEY',
      'FLUTTERWAVE_PUBLIC_KEY',
      'FLUTTERWAVE_WEBHOOK_SECRET',
      'NEXT_PUBLIC_PHARMACY_APP_URL',
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
    ],
  },
}

function parseEnv(content) {
  const out = {}
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    out[key] = val
  }
  return out
}

function upsertEnv(cwd, label, key, value, environments) {
  const sensitive = key.includes('SECRET') || key.includes('KEY') || key.includes('TOKEN')
  for (const env of environments) {
    if (DRY) {
      console.log(`[dry-run] ${label} ${env} ${key}=${value ? '(set)' : '(empty)'}`)
      continue
    }
    spawnSync('npx', ['vercel', 'env', 'rm', key, env, '-y', '-S', SCOPE], {
      cwd,
      stdio: 'ignore',
      shell: true,
    })
    const args = [
      'vercel', 'env', 'add', key, env,
      '--value', value,
      '--yes',
      '--force',
      '-S', SCOPE,
    ]
    if (sensitive) args.push('--sensitive')
    const r = spawnSync('npx', args, { cwd, encoding: 'utf-8', shell: true })
    if (r.status !== 0) {
      console.error(`✗ ${label} [${env}] ${key}:`, (r.stderr || r.stdout || '').trim())
      return false
    }
    console.log(`✓ ${label} [${env}] ${key}`)
  }
  return true
}

const envPath = resolve(ROOT, '.env')
if (!existsSync(envPath)) {
  console.error('Missing .env at repo root')
  process.exit(1)
}

const env = parseEnv(readFileSync(envPath, 'utf-8'))
const ENVIRONMENTS = ['production', 'preview', 'development']

const requiredFlutterwave = ['FLUTTERWAVE_SECRET_KEY', 'FLUTTERWAVE_WEBHOOK_SECRET', 'CRON_SECRET']
const filledRequired = requiredFlutterwave.filter((k) => env[k]?.trim())
if (filledRequired.length === 0) {
  console.warn('\n⚠ Flutterwave keys are still empty in .env.')
  console.warn('  Fill in: FLUTTERWAVE_SECRET_KEY, FLUTTERWAVE_WEBHOOK_SECRET, CRON_SECRET')
  console.warn('  Then re-run: node scripts/sync-flutterwave-vercel.mjs\n')
}

for (const cfg of Object.values(PROJECTS)) {
  if (!existsSync(resolve(cfg.cwd, '.vercel', 'project.json'))) {
    console.error(`Missing ${cfg.cwd}/.vercel/project.json — run vercel link first`)
    continue
  }
  console.log(`\n── ${cfg.label} ──`)
  for (const key of cfg.vars) {
    const value = env[key] ?? ''
    if (!value.trim() && key.startsWith('FLUTTERWAVE')) {
      console.log(`  skip ${key} (empty in .env)`)
      continue
    }
    if (!value.trim() && key === 'CRON_SECRET') {
      console.log(`  skip ${key} (empty in .env)`)
      continue
    }
    upsertEnv(cfg.cwd, cfg.label, key, value, ENVIRONMENTS)
  }
}

const appUrl = env.NEXT_PUBLIC_APP_URL || 'https://synapseos.tech'
console.log('\n── Flutterwave webhook (register in dashboard) ──')
console.log(`  URL:    ${appUrl}/api/billing/webhook/flutterwave`)
console.log(`  Secret: same as FLUTTERWAVE_WEBHOOK_SECRET in .env`)
console.log('\nDone. Redeploy synpase-os + synapse-pharm on Vercel after syncing.')
