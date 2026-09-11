import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { test } from "node:test"

const scriptPath = join(dirname(fileURLToPath(import.meta.url)), "readiness-report.mjs")

function run(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim()
}

function makeRepo() {
  const dir = mkdtempSync(join(tmpdir(), "readiness-report-test-"))
  run(dir, ["init", "-q"])
  run(dir, ["config", "user.email", "test@example.test"])
  run(dir, ["config", "user.name", "Test"])
  writeFileSync(join(dir, "README.md"), "seed")
  run(dir, ["add", "-A"])
  run(dir, ["commit", "-q", "-m", "seed"])
  return dir
}

function writeEvidence(dir, name, data) {
  mkdirSync(join(dir, "artifacts", "readiness"), { recursive: true })
  writeFileSync(join(dir, "artifacts", "readiness", name), JSON.stringify(data, null, 2))
}

function runReport(dir, env = {}) {
  try {
    const stdout = execFileSync("node", [scriptPath], { cwd: dir, encoding: "utf8", env: { ...process.env, ...env } })
    return { exitCode: 0, report: JSON.parse(stdout) }
  } catch (err) {
    return { exitCode: err.status ?? 1, report: JSON.parse(err.stdout) }
  }
}

function fullyGreenEnv(dir) {
  const sha = run(dir, ["rev-parse", "HEAD"])
  writeEvidence(dir, "health-smoke.json", { overall: "PASS", generatedAt: new Date().toISOString() })
  writeEvidence(dir, "migration-history.json", { errors: [], headSha: sha })
  return {
    BUILD_STATUS: "PASS",
    BUILD_COMPLETED_AT: new Date().toISOString(),
    DEPLOYMENT_SHA: sha,
  }
}

test("reports PASS only when every mandatory check genuinely passes with fresh, matching evidence", () => {
  const dir = makeRepo()
  try {
    const env = fullyGreenEnv(dir)
    const { exitCode, report } = runReport(dir, env)
    assert.equal(report.overall, "PASS")
    assert.equal(exitCode, 0)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("an arbitrary, unrecognized status string never becomes PASS", () => {
  const dir = makeRepo()
  try {
    const env = fullyGreenEnv(dir)
    env.BUILD_STATUS = "TOTALLY_FINE_TRUST_ME"
    const { exitCode, report } = runReport(dir, env)
    assert.notEqual(report.overall, "PASS")
    assert.notEqual(exitCode, 0)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

for (const badStatus of ["SKIPPED", "UNKNOWN", "DEGRADED", "BLOCKED", "", undefined]) {
  test(`build status "${badStatus}" never becomes PASS`, () => {
    const dir = makeRepo()
    try {
      const env = fullyGreenEnv(dir)
      if (badStatus === undefined) delete env.BUILD_STATUS
      else env.BUILD_STATUS = badStatus
      const { report } = runReport(dir, env)
      assert.notEqual(report.overall, "PASS")
      assert.notEqual(report.checks.build.status, "PASS")
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
}

test("stale evidence is not treated as PASS", () => {
  const dir = makeRepo()
  try {
    const env = fullyGreenEnv(dir)
    const sha = run(dir, ["rev-parse", "HEAD"])
    writeEvidence(dir, "health-smoke.json", { overall: "PASS", generatedAt: new Date(Date.now() - 48 * 3600000).toISOString() })
    writeEvidence(dir, "migration-history.json", { errors: [], headSha: sha })
    const { report } = runReport(dir, env)
    assert.notEqual(report.overall, "PASS")
    assert.notEqual(report.checks.health.status, "PASS")
    assert.equal(report.checks.health.freshness.fresh, false)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("a deployment SHA from another commit is blocked, not passed", () => {
  const dir = makeRepo()
  try {
    const env = fullyGreenEnv(dir)
    env.DEPLOYMENT_SHA = "0000000000000000000000000000000000000000"
    const { report } = runReport(dir, env)
    assert.equal(report.checks.deployment.shaMatch, false)
    assert.notEqual(report.checks.deployment.status, "PASS")
    assert.notEqual(report.overall, "PASS")
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("an unexpected environment is blocked when an expected environment is declared", () => {
  const dir = makeRepo()
  try {
    const env = fullyGreenEnv(dir)
    env.READINESS_ENVIRONMENT = "staging"
    env.READINESS_EXPECTED_ENVIRONMENT = "production"
    const { report } = runReport(dir, env)
    assert.notEqual(report.checks.environment.status, "PASS")
    assert.notEqual(report.overall, "PASS")
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("contradictory migration status (errors present) is never PASS even if a PASS-like field is set elsewhere", () => {
  const dir = makeRepo()
  try {
    const env = fullyGreenEnv(dir)
    const sha = run(dir, ["rev-parse", "HEAD"])
    writeEvidence(dir, "migration-history.json", { errors: ["migration modified since baseline: x.sql"], headSha: sha })
    const { report } = runReport(dir, env)
    assert.equal(report.checks.migrationCompatibility.status, "FAIL")
    assert.equal(report.overall, "FAIL")
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("missing migration-history evidence blocks rather than defaulting to PASS", () => {
  const dir = makeRepo()
  try {
    const env = fullyGreenEnv(dir)
    rmSync(join(dir, "artifacts", "readiness", "migration-history.json"))
    const { report } = runReport(dir, env)
    assert.notEqual(report.checks.migrationCompatibility.status, "PASS")
    assert.notEqual(report.overall, "PASS")
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("malformed evidence JSON is treated as absent, not PASS", () => {
  const dir = makeRepo()
  try {
    const env = fullyGreenEnv(dir)
    mkdirSync(join(dir, "artifacts", "readiness"), { recursive: true })
    writeFileSync(join(dir, "artifacts", "readiness", "health-smoke.json"), "{not valid json")
    const { report } = runReport(dir, env)
    assert.notEqual(report.checks.health.status, "PASS")
    assert.notEqual(report.overall, "PASS")
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("worktree identity changes when untracked implementation files change, and is not a bare diff length", () => {
  const dir = makeRepo()
  try {
    const env = fullyGreenEnv(dir)
    const { report: before } = runReport(dir, env)
    writeFileSync(join(dir, "new-untracked-file.ts"), "export const x = 1")
    const { report: after } = runReport(dir, env)
    assert.notEqual(before.worktreeIdentity, after.worktreeIdentity)
    assert.equal(typeof after.worktreeIdentity, "string")
    assert.equal(after.worktreeIdentity.length, 64)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
