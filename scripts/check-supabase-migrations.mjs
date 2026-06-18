#!/usr/bin/env node
/**
 * Validates migration folder integrity before push / deploy.
 * Does not require Docker — catches duplicate versions and empty files.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const migrationsDir = join(root, 'supabase', 'migrations')

let files
try {
  files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
} catch {
  console.error('[db:check] supabase/migrations directory not found')
  process.exit(1)
}

if (files.length === 0) {
  console.error('[db:check] no migration files found')
  process.exit(1)
}

const errors = []
const seenNames = new Set()

for (const file of files) {
  const path = join(migrationsDir, file)
  const stat = statSync(path)
  if (stat.size === 0) {
    errors.push(`empty migration: ${file}`)
  }

  const version = file.replace(/\.sql$/i, '')
  if (seenNames.has(version)) {
    errors.push(`duplicate migration version: ${version}`)
  }
  seenNames.add(version)

  if (!/^\d{8,14}_/i.test(version) && version !== 'demo_schema_init') {
    errors.push(`migration should start with timestamp prefix (YYYYMMDD…): ${file}`)
  }

  const sql = readFileSync(path, 'utf8')
  if (!/\b(create|alter|drop|insert|update|delete|grant|revoke|comment)\b/i.test(sql)) {
    errors.push(`migration may be empty or invalid SQL: ${file}`)
  }
}

if (errors.length > 0) {
  console.error('[db:check] migration validation failed:')
  for (const e of errors) console.error(`  - ${e}`)
  process.exit(1)
}

console.log(`[db:check] ${files.length} migration files OK`)
for (const f of files.slice(-3)) {
  console.log(`  · ${f}`)
}
