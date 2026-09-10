#!/usr/bin/env node
import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"

const root = process.cwd()
const evidenceDir = join(root, "artifacts", "readiness")
const MAX_EVIDENCE_AGE_MS = 24 * 60 * 60 * 1000

const readJson = async (name) => readFile(join(evidenceDir, name), "utf8").then(JSON.parse).catch(() => null)
const git = (args) => {
  try {
    return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim()
  } catch {
    return null
  }
}
const gitRaw = (args) => {
  try {
    return execFileSync("git", args, { cwd: root, encoding: "utf8" })
  } catch {
    return ""
  }
}

function freshness(timestamp) {
  if (!timestamp) return { fresh: false, reason: "missing evidence timestamp" }
  const parsed = Date.parse(timestamp)
  if (Number.isNaN(parsed)) return { fresh: false, reason: "malformed evidence timestamp" }
  const ageMs = Date.now() - parsed
  if (ageMs < 0) return { fresh: false, reason: "evidence timestamp is in the future" }
  if (ageMs > MAX_EVIDENCE_AGE_MS) return { fresh: false, reason: `evidence is ${Math.round(ageMs / 3600000)}h old (max ${MAX_EVIDENCE_AGE_MS / 3600000}h)` }
  return { fresh: true, reason: null }
}

/**
 * A single status literal is the only value that can ever mark a check as
 * passing. Any other value — including strings nobody thought to explicitly
 * fail on (SKIPPED, UNKNOWN, DEGRADED, BLOCKED, typos, empty, malformed JSON)
 * — falls through to "not PASS" rather than silently becoming green.
 */
const PASS = "PASS"
function isPass(status) {
  return status === PASS
}

function worktreeIdentity() {
  // Cryptographic identity of the effective worktree: HEAD sha + tracked
  // staged/unstaged diff + full contents of untracked, non-ignored files.
  // This deliberately does not use diff *length* as a proxy for content.
  const headSha = git(["rev-parse", "HEAD"]) || ""
  const trackedDiff = gitRaw(["diff", "--no-ext-diff", "--binary", "HEAD"])
  const untrackedFiles = git(["ls-files", "--others", "--exclude-standard"])
    .split("\n")
    .filter(Boolean)
    .sort()
  const hash = createHash("sha256").update(headSha).update("\u0000").update(trackedDiff)
  for (const file of untrackedFiles) {
    hash.update("\u0000").update(file).update("\u0000")
    try {
      hash.update(gitRaw(["hash-object", file]))
    } catch {
      hash.update("unreadable")
    }
  }
  return {
    sha256: hash.digest("hex"),
    dirty: Boolean(trackedDiff) || untrackedFiles.length > 0,
    untrackedCount: untrackedFiles.length,
  }
}

const sourceSha = git(["rev-parse", "HEAD"])
const deploymentSha = process.env.DEPLOYMENT_SHA ?? null
const environment = process.env.READINESS_ENVIRONMENT ?? process.env.VERCEL_ENV ?? "local"
const expectedEnvironment = process.env.READINESS_EXPECTED_ENVIRONMENT ?? null

const health = await readJson("health-smoke.json")
const migrationHistory = await readJson("migration-history.json")

const buildStatusRaw = process.env.BUILD_STATUS ?? "UNKNOWN"
const buildFreshness = freshness(process.env.BUILD_COMPLETED_AT ?? null)
const buildChecksOut = isPass(buildStatusRaw) && buildFreshness.fresh
const buildStatus = buildChecksOut ? PASS : buildStatusRaw === PASS ? "BLOCKED" : buildStatusRaw

const migrationStatus = (() => {
  if (!migrationHistory) return "BLOCKED"
  if (!Array.isArray(migrationHistory.errors)) return "BLOCKED"
  if (migrationHistory.errors.length > 0) return "FAIL"
  if (migrationHistory.headSha && sourceSha && migrationHistory.headSha !== sourceSha) return "BLOCKED"
  return PASS
})()

const healthFreshness = freshness(health?.generatedAt ?? null)
const healthStatus = !health ? "NOT_CONFIGURED" : !healthFreshness.fresh ? "STALE" : isPass(health.overall) ? PASS : health.overall ?? "UNKNOWN"

const shaMatch = Boolean(deploymentSha) && Boolean(sourceSha) && deploymentSha === sourceSha
const deploymentStatus = deploymentSha ? (shaMatch ? PASS : "BLOCKED") : "UNKNOWN"

const environmentStatus = expectedEnvironment ? (environment === expectedEnvironment ? PASS : "BLOCKED") : PASS

const identity = worktreeIdentity()

const checks = {
  build: { status: buildStatus, evidence: "BUILD_STATUS + BUILD_COMPLETED_AT", freshness: buildFreshness },
  migrationCompatibility: {
    status: migrationStatus,
    evidence: migrationHistory ? "artifacts/readiness/migration-history.json" : "missing migration-history evidence",
    errors: migrationHistory?.errors ?? null,
    reconciliation: migrationHistory?.remoteReconciliation ?? "UNKNOWN",
  },
  health: { status: healthStatus, evidence: health ? "artifacts/readiness/health-smoke.json" : "missing health evidence", freshness: healthFreshness },
  deployment: { status: deploymentStatus, deploymentSha, sourceSha, shaMatch },
  environment: { status: environmentStatus, environment, expectedEnvironment },
}

const statuses = Object.values(checks).map((check) => check.status)
const anyFail = statuses.includes("FAIL")
const allPass = statuses.every(isPass)
// Reconciliation is explicitly operator-controlled and is never itself PASS —
// a JSON field saying BLOCKED here is a signal, not something to override.
const reconciliationBlocked = checks.migrationCompatibility.reconciliation !== undefined && checks.migrationCompatibility.reconciliation !== null
const overall = anyFail ? "FAIL" : allPass ? "PASS" : "BLOCKED"

const report = {
  overall,
  generatedAt: new Date().toISOString(),
  environment,
  sourceSha,
  worktree: identity.dirty ? "DIRTY" : "CLEAN",
  worktreeIdentity: identity.sha256,
  untrackedFileCount: identity.untrackedCount,
  checks,
  remoteMigrationReconciliation: "BLOCKED_OPERATOR_CONTROLLED",
  notes: reconciliationBlocked
    ? "remote migration ledger reconciliation remains a separate, explicit operator-controlled action and never contributes a PASS"
    : null,
}

await mkdir(evidenceDir, { recursive: true })
await writeFile(join(evidenceDir, "readiness-report.json"), `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify(report, null, 2))

if (report.overall !== PASS) process.exitCode = 1

