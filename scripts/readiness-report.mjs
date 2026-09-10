#!/usr/bin/env node
import { execFileSync } from "node:child_process"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"

const root = process.cwd()
const evidenceDir = join(root, "artifacts", "readiness")
const readJson = async (name) => readFile(join(evidenceDir, name), "utf8").then(JSON.parse).catch(() => null)
const git = (args) => {
  try { return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim() } catch { return null }
}

const health = await readJson("health-smoke.json")
const buildStatus = process.env.BUILD_STATUS ?? "UNKNOWN"
const migrationStatus = process.env.MIGRATION_COMPATIBILITY ?? "BLOCKED"
const deploymentSha = process.env.DEPLOYMENT_SHA ?? null
const sourceSha = git(["rev-parse", "HEAD"])
const dirty = Boolean(git(["status", "--porcelain"]))
const checks = {
  build: { status: buildStatus, evidence: "BUILD_STATUS" },
  migrationCompatibility: { status: migrationStatus, evidence: "MIGRATION_COMPATIBILITY" },
  health: { status: health?.overall ?? "NOT_CONFIGURED", evidence: health ? "artifacts/readiness/health-smoke.json" : "missing health evidence" },
  deployment: { status: deploymentSha ? "PASS" : "UNKNOWN", deploymentSha },
}
const statuses = Object.values(checks).map((check) => check.status)
const overall = statuses.includes("FAIL") || statuses.includes("FAILING") ? "FAIL" : statuses.includes("BLOCKED") || statuses.includes("UNKNOWN") || statuses.includes("NOT_CONFIGURED") ? "BLOCKED" : "PASS"
const report = {
  overall,
  generatedAt: new Date().toISOString(),
  evidenceTimestamp: health?.generatedAt ?? null,
  environment: process.env.READINESS_ENVIRONMENT ?? process.env.VERCEL_ENV ?? "local",
  sourceSha,
  worktree: dirty ? "DIRTY" : "CLEAN",
  patchIdentity: dirty ? git(["diff", "--no-ext-diff", "--binary", "HEAD"])?.length ?? null : null,
  checks,
  remoteMigrationReconciliation: "BLOCKED_OPERATOR_CONTROLLED",
}

await mkdir(evidenceDir, { recursive: true })
await writeFile(join(evidenceDir, "readiness-report.json"), `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify(report, null, 2))
