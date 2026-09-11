#!/usr/bin/env node
import { createHash } from "node:crypto"
import { existsSync, readdirSync, readFileSync } from "node:fs"
import { execFileSync } from "node:child_process"
import { join } from "node:path"

const root = process.cwd()
const migrationDir = join(root, "supabase", "migrations")
const baselineRef = process.env.MIGRATION_HISTORY_BASELINE ?? "e624986"
const legacyExceptions = new Set(["demo_schema_init.sql"])
const legacyVersionExceptions = new Map([
  ["20260609_missing_operational_tables.sql", "historical duplicate prefix retained for production ledger compatibility"],
  ["20260609_pharmacy_network_onboarding.sql", "historical duplicate prefix retained for production ledger compatibility"],
])
// Reviewed, checked-in exceptions only — never controlled by an environment
// variable an operator or CI input could set at run time. Every entry here
// must correspond to a specific commit-reviewed justification.
const reviewedModificationExceptions = new Map([
  // ["20260101_example.sql", "reason + reviewing PR link"],
  ["20260524_public_demo_schema.sql", "stripped a leading UTF-8 BOM that made this file fail to apply via `supabase db reset`/`start` (\"syntax error at or near ''\"); no SQL statement content was changed, verified via byte-for-byte diff excluding the 3-byte BOM prefix"],
])
const reviewedBaselineUnavailableExceptions = new Set([
  // "some-ref" — only ever add with an accompanying reviewed justification.
])

const fail = (message) => {
  console.error(`[db:history:check] ${message}`)
  process.exitCode = 1
}

function hash(value) {
  return createHash("sha256").update(value).digest("hex")
}

function normalizeSql(sql) {
  return sql.replace(/--.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\s+/g, " ").trim().toLowerCase()
}

function git(args) {
  try {
    return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim()
  } catch {
    return ""
  }
}

function gitRaw(args) {
  try {
    return execFileSync("git", args, { cwd: root, encoding: "utf8" })
  } catch {
    return ""
  }
}

function versionFor(file) {
  if (legacyVersionExceptions.has(file)) return null
  const match = file.match(/^(\d+)(?:_|-)/)
  return match ? match[1] : null
}

if (!existsSync(migrationDir)) {
  fail("supabase/migrations directory missing")
  process.exit()
}

const files = readdirSync(migrationDir).filter((file) => file.endsWith(".sql")).sort()
if (files.length === 0) {
  fail("no migration files found")
  process.exit()
}

const errors = []
const warnings = []
const seenVersions = new Map()
const inventory = []

for (const file of files) {
  const version = versionFor(file)
  if (!version && !legacyExceptions.has(file) && !legacyVersionExceptions.has(file)) errors.push(`unclassified migration filename: ${file}`)
  if (legacyVersionExceptions.has(file)) warnings.push(`legacy version exception: ${file} (${legacyVersionExceptions.get(file)})`)
  if (version && seenVersions.has(version)) errors.push(`duplicate migration version prefix ${version}: ${seenVersions.get(version)} and ${file}`)
  if (version) seenVersions.set(version, file)

  const path = join(migrationDir, file)
  const sql = readFileSync(path, "utf8")
  if (sql.trim().length === 0) errors.push(`empty migration: ${file}`)
  if (!/\b(create|alter|drop|insert|update|delete|grant|revoke|comment)\b/i.test(sql)) errors.push(`migration may be empty or invalid SQL: ${file}`)
  inventory.push({
    file,
    version,
    legacyException: !version,
    rawSha256: hash(sql),
    normalizedSha256: hash(normalizeSql(sql)),
    lastCommit: git(["log", "-1", "--format=%H", "--", `supabase/migrations/${file}`]) || null,
  })
}

const baselineResolvable = Boolean(git(["rev-parse", "--verify", "--quiet", `${baselineRef}^{commit}`]))

const baselineFiles = baselineResolvable
  ? git(["ls-tree", "-r", "--name-only", baselineRef, "supabase/migrations"])
      .split("\n")
      .filter(Boolean)
      .map((path) => path.replace(/^supabase\/migrations\//, ""))
  : []

if (!baselineResolvable) {
  if (reviewedBaselineUnavailableExceptions.has(baselineRef)) {
    warnings.push(`baseline ${baselineRef} is unavailable; proceeding under a reviewed, checked-in exception`)
  } else {
    errors.push(
      `baseline ${baselineRef} could not be resolved in this clone (likely a shallow checkout that never fetched it); ` +
        `fetch the exact baseline SHA before running this check, or add a reviewed entry to reviewedBaselineUnavailableExceptions`,
    )
  }
} else {
  const currentNames = new Set(files)
  const baselineNames = new Set(baselineFiles)
  for (const file of baselineFiles) {
    if (!currentNames.has(file)) {
      errors.push(`migration deleted since ${baselineRef}: ${file}`)
    } else {
      const baselineSql = gitRaw(["show", `${baselineRef}:supabase/migrations/${file}`])
      const current = inventory.find((item) => item.file === file)
      // Raw hash is the sole integrity authority — normalized-SQL hashes are
      // informational only and must never substitute for byte-identical proof.
      if (current && current.rawSha256 !== hash(baselineSql)) {
        if (reviewedModificationExceptions.has(file)) {
          warnings.push(`migration modified since ${baselineRef}: ${file} (reviewed exception: ${reviewedModificationExceptions.get(file)})`)
        } else {
          errors.push(`migration modified since ${baselineRef}: ${file} (raw hash differs from the approved baseline; historical migrations must not change without a reviewed, checked-in exception)`)
        }
      }
    }
  }
  for (const file of files) if (!baselineNames.has(file)) warnings.push(`migration added since ${baselineRef}: ${file}`)
}

const output = {
  baselineRef,
  headSha: git(["rev-parse", "HEAD"]) || null,
  generatedAt: new Date().toISOString(),
  migrationCount: inventory.length,
  migrations: inventory,
  errors,
  warnings,
  remoteReconciliation: "BLOCKED_OPERATOR_CONTROLLED",
}
console.log(JSON.stringify(output, null, 2))

try {
  const { mkdirSync, writeFileSync } = await import("node:fs")
  const evidenceDir = join(root, "artifacts", "readiness")
  mkdirSync(evidenceDir, { recursive: true })
  writeFileSync(join(evidenceDir, "migration-history.json"), `${JSON.stringify(output, null, 2)}\n`)
} catch {
  // Evidence persistence is best-effort; the console JSON above is the authoritative output for this run.
}

if (errors.length) {
  console.error("[db:history:check] read-only migration history validation failed")
  process.exitCode = 1
} else {
  console.error(`[db:history:check] ${inventory.length} local migrations inventoried against baseline ${baselineRef}`)
  for (const warning of warnings) console.error(`[db:history:check] WARNING: ${warning}`)
  console.error("[db:history:check] remote migration ledger reconciliation remains a separate, explicit operator-controlled action")
}
