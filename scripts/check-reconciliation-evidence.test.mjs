import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { createHash } from "node:crypto"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { test } from "node:test"

const scriptPath = join(dirname(fileURLToPath(import.meta.url)), "check-reconciliation-evidence.mjs")

function run(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim()
}

function sha256(content) {
  return createHash("sha256").update(content).digest("hex")
}

function makeRepo() {
  const dir = mkdtempSync(join(tmpdir(), "reconciliation-evidence-test-"))
  run(dir, ["init", "-q"])
  run(dir, ["config", "user.email", "test@example.test"])
  run(dir, ["config", "user.name", "Test"])
  writeFileSync(join(dir, "README.md"), "seed")
  run(dir, ["add", "-A"])
  run(dir, ["commit", "-q", "-m", "seed"])
  return dir
}

function writeArtifact(dir, name, data) {
  mkdirSync(join(dir, "artifacts", "readiness"), { recursive: true })
  writeFileSync(join(dir, "artifacts", "readiness", name), JSON.stringify(data, null, 2))
}

function runCheck(dir, env = {}) {
  try {
    const stdout = execFileSync("node", [scriptPath], { cwd: dir, encoding: "utf8", env: { ...process.env, ...env } })
    return { exitCode: 0, output: JSON.parse(stdout) }
  } catch (err) {
    return { exitCode: err.status ?? 1, output: JSON.parse(err.stdout) }
  }
}

function seedFullyBoundEvidence(dir) {
  const sha = run(dir, ["rev-parse", "HEAD"])
  const migrations = [{ file: "20260101000000_init.sql", rawSha256: "abc123" }]
  writeArtifact(dir, "migration-history.json", {
    migrations,
    warnings: ["migration added since baseline: 20260909130000_pending.sql"],
  })
  const snapshotContent = "remote ledger export contents\n"
  mkdirSync(join(dir, "artifacts", "readiness"), { recursive: true })
  writeFileSync(join(dir, "artifacts", "readiness", "remote-ledger-snapshot.txt"), snapshotContent)

  const localMigrationHashesSha256 = sha256(JSON.stringify(migrations.map((m) => [m.file, m.rawSha256])))
  writeArtifact(dir, "reconciliation-evidence.json", {
    supabaseProjectId: "qfqakzmjatszisuqjwon",
    sourceShaFull: sha,
    remoteLedgerSnapshotPath: "artifacts/readiness/remote-ledger-snapshot.txt",
    remoteLedgerSnapshotSha256: sha256(snapshotContent),
    localMigrationHashesSha256,
    reviewedPendingMigrations: ["20260909130000_pending.sql"],
    reviewedAt: new Date().toISOString(),
    operator: "jane.operator",
    operatorConfirmed: true,
  })
}

test("fully bound, fresh, operator-confirmed evidence passes with no problems", () => {
  const dir = makeRepo()
  try {
    seedFullyBoundEvidence(dir)
    const { exitCode, output } = runCheck(dir)
    assert.equal(exitCode, 0)
    assert.equal(output.problems.length, 0)
    assert.equal(output.operatorConfirmed, true)
    assert.equal(output.boundEvidenceVerified, true)
    assert.equal(output.productionMigrationAuthorization, "NEVER_GRANTED_BY_THIS_CHECK")
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("missing evidence file fails closed", () => {
  const dir = makeRepo()
  try {
    const { exitCode, output } = runCheck(dir)
    assert.equal(exitCode, 1)
    assert.ok(output.problems.some((p) => p.includes("no reconciliation evidence file")))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("evidence pinned to a different commit than HEAD fails, even if operatorConfirmed is true", () => {
  const dir = makeRepo()
  try {
    seedFullyBoundEvidence(dir)
    const raw = JSON.parse(readFileSync(join(dir, "artifacts", "readiness", "reconciliation-evidence.json"), "utf8"))
    raw.sourceShaFull = "0".repeat(40)
    writeArtifact(dir, "reconciliation-evidence.json", raw)

    const { exitCode, output } = runCheck(dir)
    assert.equal(exitCode, 1)
    assert.equal(output.operatorConfirmed, true)
    assert.equal(output.boundEvidenceVerified, false)
    assert.ok(output.problems.some((p) => p.includes("does not match current HEAD")))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("a tampered remote ledger snapshot (hash mismatch) fails", () => {
  const dir = makeRepo()
  try {
    seedFullyBoundEvidence(dir)
    writeFileSync(join(dir, "artifacts", "readiness", "remote-ledger-snapshot.txt"), "tampered content\n")

    const { exitCode, output } = runCheck(dir)
    assert.equal(exitCode, 1)
    assert.ok(output.problems.some((p) => p.includes("does not match the content")))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("a reviewed pending-migration set that omits an actually-pending migration fails", () => {
  const dir = makeRepo()
  try {
    seedFullyBoundEvidence(dir)
    const evidenceFile = join(dir, "artifacts", "readiness", "reconciliation-evidence.json")
    const raw = JSON.parse(readFileSync(evidenceFile, "utf8"))
    raw.reviewedPendingMigrations = []
    writeArtifact(dir, "reconciliation-evidence.json", raw)

    const { exitCode, output } = runCheck(dir)
    assert.equal(exitCode, 1)
    assert.ok(output.problems.some((p) => p.includes("missing files the migration-history evidence reports as pending")))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("operatorConfirmed=false fails even when every binding is otherwise valid", () => {
  const dir = makeRepo()
  try {
    seedFullyBoundEvidence(dir)
    const evidenceFile = join(dir, "artifacts", "readiness", "reconciliation-evidence.json")
    const raw = JSON.parse(readFileSync(evidenceFile, "utf8"))
    raw.operatorConfirmed = false
    writeArtifact(dir, "reconciliation-evidence.json", raw)

    const { exitCode, output } = runCheck(dir)
    assert.equal(exitCode, 1)
    assert.equal(output.operatorConfirmed, false)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("stale reviewedAt beyond the max age fails", () => {
  const dir = makeRepo()
  try {
    seedFullyBoundEvidence(dir)
    const evidenceFile = join(dir, "artifacts", "readiness", "reconciliation-evidence.json")
    const raw = JSON.parse(readFileSync(evidenceFile, "utf8"))
    raw.reviewedAt = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
    writeArtifact(dir, "reconciliation-evidence.json", raw)

    const { exitCode, output } = runCheck(dir)
    assert.equal(exitCode, 1)
    assert.ok(output.problems.some((p) => p.includes("freshness check")))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
