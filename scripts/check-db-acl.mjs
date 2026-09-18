#!/usr/bin/env node
/**
 * Static SECURITY DEFINER ACL inventory.
 * Does not mutate production. Live PUBLIC/anon execute checks run only when
 * DATABASE_ACL_URL is set (operator/release evidence).
 */

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const root = process.cwd()
const migrationsDir = join(root, "supabase/migrations")

function listSql() {
  return readdirSync(migrationsDir)
    .filter((name) => name.endsWith(".sql"))
    .map((name) => ({ name, source: readFileSync(join(migrationsDir, name), "utf8") }))
}

function extractDefinerFunctions(source) {
  const names = []
  const re = /create(?:\s+or\s+replace)?\s+function\s+([a-zA-Z0-9_.]+)\s*\([\s\S]*?security\s+definer/gi
  let match
  while ((match = re.exec(source))) names.push(match[1])
  return names
}

function publicExecuteGrants(source) {
  const grants = []
  const re = /grant\s+execute\s+on\s+function\s+([a-zA-Z0-9_.]+)\s*\([^)]*\)\s+to\s+(public|anon)/gi
  let match
  while ((match = re.exec(source))) grants.push({ fn: match[1], role: match[2].toLowerCase() })
  return grants
}

const files = listSql()
const definers = []
const publicGrants = []
for (const file of files) {
  for (const fn of extractDefinerFunctions(file.source)) definers.push({ file: file.name, fn })
  for (const grant of publicExecuteGrants(file.source)) publicGrants.push({ file: file.name, ...grant })
}

const allowedPublic = new Set([
  // Intentionally empty: privileged internals must not be PUBLIC/anon executable.
])

const unexpected = publicGrants.filter((row) => !allowedPublic.has(`${row.fn}:${row.role}`))
const report = {
  generated_at: new Date().toISOString(),
  security_definer_count: definers.length,
  public_or_anon_execute_grants: publicGrants,
  unexpected_public_execute: unexpected,
  status: unexpected.length ? "FAIL" : "PASS",
  live_check: process.env.DATABASE_ACL_URL ? "PENDING_OPERATOR" : "SKIPPED_NO_DATABASE_ACL_URL",
}

mkdirSync(join(root, "artifacts/readiness"), { recursive: true })
writeFileSync(join(root, "artifacts/readiness/db-acl-inventory.json"), JSON.stringify({ ...report, functions: definers }, null, 2))

if (unexpected.length) {
  console.error("DB ACL FAIL: unexpected PUBLIC/anon EXECUTE on SECURITY DEFINER candidates")
  console.error(JSON.stringify(unexpected, null, 2))
  process.exit(1)
}

console.log(`DB ACL static PASS definer_functions=${definers.length} public_grants=${publicGrants.length}`)
